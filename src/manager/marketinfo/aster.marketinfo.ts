import { blogger } from '../../common/base/logger.js';
import { rdsClient } from '../../common/db/redis.js';
import { RedisKeyMgr } from '../../common/redis.key.js';
import { EExchange } from '../../common/exchange.enum.js';
import { AsterMarketApi } from '../../libs/aster/aster.market.api.js';
import { AsterContractStatus } from '../../libs/aster/aster.enums.js';
import { AsterExchangeFilter, AsterExchangeInfo, AsterSymbolInfo, AsterFundingInfoEntry } from '../../libs/aster/aster.types.js';
import { TSMap } from '../../libs/tsmap.js';
import { TQtyFilter } from './maretinfo.type.js';
import { intervalCache, qtyFilterCache } from '../../common/cache/interval.cache.js';

const DEFAULT_MEMORY_TTL_SECONDS = 600; // 10 minutes
const DEFAULT_REDIS_TTL_SECONDS = 3600; // 1 hour
const FUNDING_INTERVAL_MEMORY_TTL_SECONDS = 3 * 60 * 60; // 3 hours
const FUNDING_INTERVAL_REDIS_TTL_SECONDS = 24 * 60 * 60; // 24 hours

type SymbolRuleMap = TSMap<string, TQtyFilter>;


export class AsterMarketInfoMgr {

  /**
   * 获取 Aster 永续合约全部交易规则（先读内存缓存）
   */
  static async getAllFutureSymbolRules(): Promise<TSMap<string, TQtyFilter>> {
    const key = `FUTURE:QtyFilter:${EExchange.Aster}`
    const qtyValue = qtyFilterCache.get(key)
    if (qtyValue) {
      return qtyValue as TSMap<string, TQtyFilter>;
    }
    const info = await this.fetchFutureMarketInfo();
    const rules = this.buildRuleMap(info);
    qtyFilterCache.set(key, rules, DEFAULT_MEMORY_TTL_SECONDS);
    return rules;
  }

  /**
   * 获取单个 Aster 永续合约的交易规则
   */
  static async getFutureSymbolRule(symbol: string): Promise<TQtyFilter | undefined> {
    const normalized = this.normalizeSymbol(symbol);
    const rules = await this.getAllFutureSymbolRules();
    return rules.get(normalized);
  }

  /**
   * 获取 Aster 永续合约的资费间隔时间（小时）
   */
  static async getFundingIntervalHours(symbol: string): Promise<number | undefined> {
    const normalized = this.normalizeSymbol(symbol);
    const intervalCacheKey = RedisKeyMgr.FundingIntervalKey(EExchange.Aster);
    const memoryValue: TSMap<string, number> | undefined = intervalCache.get(intervalCacheKey);
    if (memoryValue !== undefined) {
      return memoryValue.get(normalized);
    }

    const redisKey = RedisKeyMgr.FundingIntervalKey(EExchange.Aster);
    try {
      const redisRaw = await rdsClient.get(redisKey);
      if (redisRaw) {
        const redisValue = new TSMap<string, number>().fromJSON(JSON.parse(redisRaw));
        intervalCache.set(intervalCacheKey, redisValue, FUNDING_INTERVAL_MEMORY_TTL_SECONDS);
        return redisValue.get(normalized);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      blogger.error('aster funding interval read redis failed', { symbol: normalized, message });
    }

    const interval = await this.fetchFundingIntervalFromServer();
    try {
      await rdsClient.set(redisKey, JSON.stringify(interval), FUNDING_INTERVAL_REDIS_TTL_SECONDS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      blogger.error('aster funding interval write redis failed', { symbol: normalized, message });
    }
    intervalCache.set(intervalCacheKey, interval, FUNDING_INTERVAL_MEMORY_TTL_SECONDS);
    return interval.get(normalized);
  }

  /**
   * 拉取 Aster 永续合约市场信息（先读 Redis，失效时调用接口并回写）
   */
  static async fetchFutureMarketInfo(): Promise<AsterExchangeInfo> {
    try {
      const marketInfoKey = RedisKeyMgr.MarketInfoKey(EExchange.Aster);
      const raw = await rdsClient.get(marketInfoKey);
      if (raw) {
        return JSON.parse(raw) as AsterExchangeInfo;
      }
      const marketApi = new AsterMarketApi();
      const info = await marketApi.getExchangeInfo();
      await rdsClient.set(marketInfoKey, JSON.stringify(info), DEFAULT_REDIS_TTL_SECONDS);
      return info;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      blogger.error('aster market info fetch failed', message);
      throw error;
    }
  }

  /**
   * 根据交易所返回的交易对信息构建规则映射
   */
  static buildRuleMap(info: AsterExchangeInfo): SymbolRuleMap {
    const map: SymbolRuleMap = new TSMap<string, TQtyFilter>();
    info.symbols.forEach((symbolInfo) => {
      if (symbolInfo.status !== AsterContractStatus.TRADING) {
        return;
      }
      const normalized = this.normalizeSymbol(symbolInfo.symbol);
      map.set(normalized, this.buildRule(symbolInfo));
    });
    return map;
  }

  /**
   * 将单个交易对信息转换为数量过滤规则
   */
  private static buildRule(symbolInfo: AsterSymbolInfo): TQtyFilter {
    const lotFilter = this.findFilter(symbolInfo.filters, 'LOT_SIZE');
    const marketLotFilter = this.findFilter(symbolInfo.filters, 'MARKET_LOT_SIZE');
    const notionalFilter = this.findFilter(symbolInfo.filters, 'MIN_NOTIONAL');

    const minQty = this.firstDefined(
      this.getFilterValue(marketLotFilter, 'minQty'),
      this.getFilterValue(lotFilter, 'minQty')
    ) ?? '0';

    const maxQty = this.firstDefined(
      this.getFilterValue(marketLotFilter, 'maxQty'),
      this.getFilterValue(lotFilter, 'maxQty')
    ) ?? '0';

    const stepSize = this.firstDefined(
      this.getFilterValue(marketLotFilter, 'stepSize'),
      this.getFilterValue(lotFilter, 'stepSize')
    ) ?? '0';

    const minNotional = this.firstDefined(
      this.getFilterValue(notionalFilter, 'notional'),
      this.getFilterValue(notionalFilter, 'minNotional')
    );

    return {
      pricePrecision: symbolInfo.pricePrecision,
      qtyPrecision: symbolInfo.quantityPrecision,
      minQty,
      maxQty,
      stepSize,
      minNotional,
    };
  }

  /**
   * 在交易对过滤器数组中查找指定类型过滤器
   */
  private static findFilter(filters: AsterExchangeFilter[], type: string): AsterExchangeFilter | undefined {
    return filters.find((filter) => filter.filterType === type);
  }

  /**
   * 从过滤器中读取指定字段的值并转成字符串
   */
  private static getFilterValue(filter: AsterExchangeFilter | undefined, key: string): string | undefined {
    if (!filter) {
      return undefined;
    }
    const value = filter[key];
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value === 'number' || typeof value === 'string') {
      return String(value);
    }
    return undefined;
  }

  /**
   * 返回入参列表中第一个已定义的值
   */
  private static firstDefined<T>(...values: (T | undefined)[]): T | undefined {
    for (const value of values) {
      if (value !== undefined) {
        return value;
      }
    }
    return undefined;
  }

  /**
   * 标准化交易对字符串
   */
  private static normalizeSymbol(symbol: string): string {
    return symbol.trim().toUpperCase();
  }

  private static parseFundingInterval(raw: string | null): number | undefined {
    if (!raw) {
      return undefined;
    }
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return undefined;
    }
    return numeric;
  }

  private static async fetchFundingIntervalFromServer(): Promise<TSMap<string, number>> {
    try {
      const marketApi = new AsterMarketApi();
      const entries = await marketApi.getFundingInfo();
      const res = new TSMap<string, number>();
      entries.forEach((entry) => {
        const interval = this.extractFundingInterval(entry);
        if (interval) {
          res.set(entry.symbol, interval);
        }
      });
      return res;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      blogger.error('aster funding interval fetch failed', { message });
      throw error;
    }
  }

  private static extractFundingInterval(entry: AsterFundingInfoEntry | undefined): number | undefined {
    if (!entry) {
      return undefined;
    }
    const interval = entry.fundingIntervalHours;
    if (typeof interval !== 'number' || !Number.isFinite(interval) || interval <= 0) {
      return undefined;
    }
    return interval;
  }
}
