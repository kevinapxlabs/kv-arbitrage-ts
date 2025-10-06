import { blogger } from '../../common/base/logger.js';
import { rdsClient } from '../../common/db/redis.js';
import { RedisKeyMgr } from '../../common/redis.key.js';
import { EExchange } from '../../common/exchange.enum.js';
import { TSMap } from '../../libs/tsmap.js';
import { intervalCache, qtyFilterCache } from '../../common/cache/interval.cache.js';
import { TQtyFilter } from './maretinfo.type.js';
import { BpxApiClient, Market } from '../../libs/bpxClient/index.js';

const DEFAULT_MEMORY_TTL_SECONDS = 600; // 10 minutes
const DEFAULT_REDIS_TTL_SECONDS = 3600; // 1 hour
const FUNDING_INTERVAL_MEMORY_TTL_SECONDS = 3 * 60 * 60; // 3 hours
const FUNDING_INTERVAL_REDIS_TTL_SECONDS = 24 * 60 * 60; // 24 hours

type SymbolRuleMap = TSMap<string, TQtyFilter>;

type BackpackMarketInfo = Market[];

export class BackpackMarketInfoMgr {
  /**
   * 获取 BackPack 永续合约的全部交易规则（先读缓存）
   */
  static async getAllFutureSymbolRules(): Promise<SymbolRuleMap> {
    const key = `FUTURE:QtyFilter:${EExchange.Backpack}`;
    const qtyValue = qtyFilterCache.get(key);
    if (qtyValue) {
      return qtyValue as SymbolRuleMap;
    }
    const info = await this.fetchFutureMarketInfo();
    const rules = this.buildRuleMap(info);
    qtyFilterCache.set(key, rules, DEFAULT_MEMORY_TTL_SECONDS);
    return rules;
  }

  /**
   * 获取单个永续合约交易对的交易规则
   */
  static async getFutureSymbolRule(symbol: string): Promise<TQtyFilter | undefined> {
    const normalized = this.normalizeSymbol(symbol);
    const rules = await this.getAllFutureSymbolRules();
    return rules.get(normalized);
  }

  /**
   * 获取 BackPack 永续合约的资费间隔时间（小时）
  */
  static async getFundingIntervalHours(symbol: string): Promise<number | undefined> {
    const normalized = this.normalizeSymbol(symbol);
    const intervalCacheKey = RedisKeyMgr.FundingIntervalKey(EExchange.Backpack);
    const memoryValue: TSMap<string, number> | undefined = intervalCache.get(intervalCacheKey);
    if (memoryValue !== undefined) {
      return memoryValue.get(normalized);
    }

    const redisKey = RedisKeyMgr.FundingIntervalKey(EExchange.Backpack);
    try {
      const redisRaw = await rdsClient.get(redisKey);
      if (redisRaw) {
        const redisValue = new TSMap<string, number>().fromJSON(JSON.parse(redisRaw));
        intervalCache.set(intervalCacheKey, redisValue, FUNDING_INTERVAL_MEMORY_TTL_SECONDS);
        return redisValue.get(normalized);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      blogger.error('backpack funding interval read redis failed', { symbol: normalized, message });
    }

    const interval = await this.fetchFundingIntervalFromServer();
    try {
      await rdsClient.set(redisKey, JSON.stringify(interval), FUNDING_INTERVAL_REDIS_TTL_SECONDS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      blogger.error('backpack funding interval write redis failed', { symbol: normalized, message });
    }
    intervalCache.set(intervalCacheKey, interval, FUNDING_INTERVAL_MEMORY_TTL_SECONDS);
    return interval.get(normalized);
  }

  /**
   * 拉取 BackPack 永续合约市场信息（优先读取 Redis，失败时调用接口并写缓存）
   */
  static async fetchFutureMarketInfo(): Promise<BackpackMarketInfo> {
    try {
      const marketInfoKey = RedisKeyMgr.MarketInfoKey(EExchange.Backpack);
      const raw = await rdsClient.get(marketInfoKey);
      if (raw) {
        return JSON.parse(raw) as BackpackMarketInfo;
      }
      const marketApi = new BpxApiClient({
        apiKey: '',
        apiSecret: ''
      });
      const info = await marketApi.markets.getMarkets();
      if (info.statusCode !== 200) {
        const msg = `backpack market info fetch failed, statusCode: ${info.statusCode}, message: ${info.error}`
        blogger.error(msg);
        throw new Error(msg);
      }
      await rdsClient.set(marketInfoKey, JSON.stringify(info.data), DEFAULT_REDIS_TTL_SECONDS);
      return info.data as BackpackMarketInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      blogger.error('backpack market info fetch failed', message);
      throw error;
    }
  }

  /**
   * 构建交易对到交易规则的映射表
   */
  static buildRuleMap(markets: BackpackMarketInfo): SymbolRuleMap {
    const map: SymbolRuleMap = new TSMap<string, TQtyFilter>();
    markets.forEach((market) => {
      if (!this.isTradableFuture(market)) {
        return;
      }
      const normalized = this.normalizeSymbol(market.symbol);
      map.set(normalized, this.buildRule(market));
    });
    return map;
  }

  /**
   * 从市场信息生成单个交易对的交易规则
   */
  private static buildRule(market: Market): TQtyFilter {
    const quantityFilter = market.filters?.quantity;
    const priceFilter = market.filters?.price;

    const minQty = quantityFilter?.minQuantity ?? '0';
    const maxQty = quantityFilter?.maxQuantity ?? '0';
    const stepSize = quantityFilter?.stepSize ?? '0';

    const pricePrecision = this.computePrecisionFromStep(priceFilter?.tickSize);
    const qtyPrecision = this.computePrecisionFromStep(stepSize);

    const result: TQtyFilter = {
      pricePrecision,
      qtyPrecision,
      minQty,
      maxQty,
      stepSize,
    };

    return result;
  }

  /**
   * 判断市场是否可交易的永续合约
   */
  private static isTradableFuture(market: Market): boolean {
    return (
      market.marketType === 'PERP' &&
      market.orderBookState === 'Open'
    );
  }

  /**
   * 标准化交易对字符串
   */
  private static normalizeSymbol(symbol: string): string {
    return symbol.trim().toUpperCase();
  }

  private static async fetchFundingIntervalFromServer(): Promise<TSMap<string, number>> {
    try {
      const markets = await this.fetchFutureMarketInfo();
      const res = new TSMap<string, number>();
      markets.forEach((market) => {
        if (!this.isTradableFuture(market)) {
          return;
        }
        const interval = this.extractFundingInterval(market);
        if (interval) {
          res.set(this.normalizeSymbol(market.symbol), interval);
        }
      });
      return res;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      blogger.error('backpack funding interval fetch failed', { message });
      throw error;
    }
  }

  private static extractFundingInterval(market: Market | undefined): number | undefined {
    if (!market || market.fundingInterval === undefined || market.fundingInterval === null) {
      return undefined;
    }
    const interval = Number(market.fundingInterval);
    if (!Number.isFinite(interval) || interval <= 0) {
      return undefined;
    }
    if (interval >= 60) {
      return interval / 3600;
    }
    return interval;
  }

  /**
   * 根据步长计算精度
   */
  private static computePrecisionFromStep(step?: string): number {
    if (!step) {
      return 0;
    }
    const normalized = step.trim();
    if (!normalized || normalized === '0') {
      return 0;
    }

    const scientificMatch = normalized.match(/^\d+(?:\.\d+)?[eE]([-+]?\d+)$/);
    if (scientificMatch) {
      const exponent = Number(scientificMatch[1]);
      return exponent < 0 ? Math.abs(exponent) : 0;
    }

    const decimalIndex = normalized.indexOf('.');
    if (decimalIndex === -1) {
      return 0;
    }

    const fractional = normalized.slice(decimalIndex + 1).replace(/0+$/, '');
    return fractional.length;
  }
}
