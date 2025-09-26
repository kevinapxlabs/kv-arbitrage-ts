import { rdsClient } from '../common/db/redis.js'
import { blogger } from '../common/base/logger.js'
import { ArbitrageRuntimeConfig, ExchangeRuntimeConfig } from '../config/config.js'
import { ExchangeId, ExchangeOrderBookQuote, OrderBookLevel, OrderBookQuote, TokenConfig } from '../exchanges/types.js'

interface RedisOrderBook {
  bids: Array<[number, number]>
  asks: Array<[number, number]>
  ts?: number
  updatedAt?: number
}

// 从 redis 读取并整理盘口数据
export class OrderBookService {
  private readonly exchangeById = new Map<ExchangeId, ExchangeRuntimeConfig>()

  constructor(
    private readonly settings: ArbitrageRuntimeConfig,
    exchangeConfigs: ExchangeRuntimeConfig[]
  ) {
    exchangeConfigs.forEach((cfg) => this.exchangeById.set(cfg.id, cfg))
  }

  // 生成当前交易所与币对的 redis key
  private resolveKey(exchangeId: ExchangeId, symbol: string): string {
    const exchangeCfg = this.exchangeById.get(exchangeId)
    const pattern = exchangeCfg?.orderbookKeyPattern ?? this.settings.orderBook.keyPattern
    return pattern.replace('{exchange}', exchangeId).replace('{symbol}', symbol)
  }

  // 判断盘口是否已过期
  private isStale(timestamp?: number): boolean {
    if (!timestamp) {
      return false
    }
    return Date.now() - timestamp > this.settings.orderBook.staleThresholdMs
  }

  // 解析 redis 中 json 结构的盘口
  private parseOrderBook(raw: string | null): RedisOrderBook | null {
    if (!raw) {
      return null
    }
    try {
      return JSON.parse(raw)
    } catch (error) {
      blogger.error('failed to parse orderbook json', error)
      return null
    }
  }

  // 提取盘口的最优买卖一档
  private extractTopLevels(data: RedisOrderBook | null): OrderBookQuote | null {
    if (!data) {
      return null
    }
    const bestBidTuple = data.bids?.[0]
    const bestAskTuple = data.asks?.[0]
    const convert = (tuple?: [number, number]): OrderBookLevel | undefined => {
      if (!tuple) {
        return undefined
      }
      const [price, size] = tuple
      return {
        price: Number(price),
        size: Number(size)
      }
    }
    const bestBid = convert(bestBidTuple)
    const bestAsk = convert(bestAskTuple)
    if (!bestBid && !bestAsk) {
      return null
    }
    return {
      bestBid,
      bestAsk,
      updatedAt: data.updatedAt ?? data.ts ?? Date.now()
    }
  }

  // 获取指定交易所的盘口最优价
  async getTopOfBook(exchangeId: ExchangeId, exchangeSymbol: string): Promise<OrderBookQuote | null> {
    const key = this.resolveKey(exchangeId, exchangeSymbol)
    const raw = await rdsClient.get(key)
    const parsed = this.parseOrderBook(raw)
    if (!parsed) {
      return null
    }
    const quote = this.extractTopLevels(parsed)
    if (!quote) {
      return null
    }
    if (this.isStale(quote.updatedAt)) {
      blogger.warn('order book stale', exchangeId, exchangeSymbol, quote.updatedAt)
      return null
    }
    return quote
  }

  // 获取指定币种在所有交易所的盘口快照
  async getQuotesForToken(token: TokenConfig): Promise<ExchangeOrderBookQuote[]> {
    const results: ExchangeOrderBookQuote[] = []
    for (const [exchangeId, mappedSymbol] of Object.entries(token.exchangeSymbols)) {
      const quote = await this.getTopOfBook(exchangeId, mappedSymbol)
      if (quote) {
        results.push({ exchangeId, symbol: mappedSymbol, quote })
      }
    }
    return results
  }
}
