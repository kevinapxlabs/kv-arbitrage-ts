import { blogger } from '../../common/base/logger.js';
import { rdsClient } from '../../common/db/redis.js';
import { RedisKeyMgr } from '../../common/redis.key.js';
import { EExchange } from '../../common/exchange.enum.js';
import { BackpackPublicApi } from '../../libs/backpack/backpack.public.api.js';
import { BackpackMarket } from '../../libs/backpack/backpack.types.js';
import { TSMap } from '../../libs/tsmap.js';
import { qtyFilterCache } from '../../common/cache/interval.cache.js';
import { QtyFilter } from './maretinfo.type.js';

const DEFAULT_MEMORY_TTL_SECONDS = 600; // 10 minutes
const DEFAULT_REDIS_TTL_SECONDS = 3600; // 1 hour

type SymbolRuleMap = TSMap<string, QtyFilter>;

type BackpackMarketInfo = BackpackMarket[];

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
  static async getFutureSymbolRule(symbol: string): Promise<QtyFilter | undefined> {
    const normalized = this.normalizeSymbol(symbol);
    const rules = await this.getAllFutureSymbolRules();
    return rules.get(normalized);
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
      const marketApi = new BackpackPublicApi();
      const info = await marketApi.getMarkets();
      await rdsClient.set(marketInfoKey, JSON.stringify(info), DEFAULT_REDIS_TTL_SECONDS);
      return info;
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
    const map: SymbolRuleMap = new TSMap<string, QtyFilter>();
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
  private static buildRule(market: BackpackMarket): QtyFilter {
    const quantityFilter = market.filters?.quantity;
    const priceFilter = market.filters?.price;

    const minQty = quantityFilter?.minQuantity ?? '0';
    const maxQty = quantityFilter?.maxQuantity ?? '0';
    const stepSize = quantityFilter?.stepSize ?? '0';

    const pricePrecision = this.computePrecisionFromStep(priceFilter?.tickSize);
    const qtyPrecision = this.computePrecisionFromStep(stepSize);

    const result: QtyFilter = {
      pricePrecision,
      qtyPrecision,
      minQty,
      maxQty,
      qtyStep: stepSize,
    };

    return result;
  }

  /**
   * 判断市场是否可交易的永续合约
   */
  private static isTradableFuture(market: BackpackMarket): boolean {
    return (
      market.marketType === 'PERP' &&
      market.orderBookState === 'Open' &&
      market.visible === true
    );
  }

  /**
   * 标准化交易对字符串
   */
  private static normalizeSymbol(symbol: string): string {
    return symbol.trim().toUpperCase();
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
