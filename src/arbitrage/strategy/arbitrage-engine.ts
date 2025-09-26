import { ArbitrageRuntimeConfig } from '../../config/config.js'
import { blogger } from '../../common/base/logger.js'
import { OrderBookService } from '../orderbook.service.js'
import { TokenRegistry } from '../token-registry.js'
import { TokenConfig, ExchangeOrderBookQuote, SpreadOpportunity, HedgePosition } from '../../exchanges/types.js'
import { ExchangeAdapter } from '../../exchanges/exchange-adapter.js'
import { PositionManager } from '../positions/position-manager.js'
import { RiskManager, QuoteMapPerSymbol } from '../risk/risk-manager.js'
import { NavReporter, buildNavSnapshot } from '../reporting/reporter.js'

const BPS_FACTOR = 10000

// 套利执行引擎，负责发现价差并驱动下单
export class ArbitrageEngine {
  private readonly quoteCache: QuoteMapPerSymbol = new Map()
  private cycleRunning = false
  private navRunning = false

  constructor(
    private readonly settings: ArbitrageRuntimeConfig,
    private readonly tokenRegistry: TokenRegistry,
    private readonly orderBookService: OrderBookService,
    private readonly exchangeAdapters: Map<string, ExchangeAdapter>,
    private readonly positionManager: PositionManager,
    private readonly riskManager: RiskManager,
    private readonly reporter: NavReporter
  ) {}

  // 初始化依赖并完成适配器预热
  async initialize(): Promise<void> {
    for (const adapter of this.exchangeAdapters.values()) {
      if (adapter.setup) {
        await adapter.setup()
      }
    }
    blogger.info('arbitrage engine initialized')
  }

  // 扫描全部币种并尝试开仓，同时进行风险检查
  async runArbitrageCycle(): Promise<void> {
    if (this.cycleRunning) {
      blogger.warn('arbitrage cycle already running, skip trigger')
      return
    }
    this.cycleRunning = true
    const tokens = this.tokenRegistry.getAll()
    try {
      for (const token of tokens) {
        await this.processToken(token)
      }
      await this.evaluateRisk()
    } catch (error) {
      blogger.error('arbitrage cycle failure', error)
    } finally {
      this.cycleRunning = false
    }
  }

  // 针对单个币种获取行情、寻找机会并尝试平仓
  private async processToken(token: TokenConfig): Promise<void> {
    const quotes = await this.orderBookService.getQuotesForToken(token)
    if (quotes.length < 2) {
      return
    }
    this.updateQuoteCache(token.symbol, quotes)
    const opportunity = this.pickBestOpportunity(token, quotes)
    if (opportunity) {
      await this.executeOpportunity(opportunity)
    }
    await this.evaluateClosures(token)
  }

  // 缓存最新盘口，为风险与报表提供数据
  private updateQuoteCache(symbol: string, quotes: ExchangeOrderBookQuote[]): void {
    let exchangeMap = this.quoteCache.get(symbol)
    if (!exchangeMap) {
      exchangeMap = new Map()
      this.quoteCache.set(symbol, exchangeMap)
    }
    quotes.forEach((quote) => exchangeMap!.set(quote.exchangeId, quote))
  }

  // 遍历所有交易所组合，寻找当前最优价差
  private pickBestOpportunity(token: TokenConfig, quotes: ExchangeOrderBookQuote[]): SpreadOpportunity | null {
    let best: SpreadOpportunity | null = null
    const thresholdBps = token.openSpreadBps ?? this.settings.defaultOpenSpreadBps
    for (const buyQuote of quotes) {
      const ask = buyQuote.quote.bestAsk
      if (!ask) continue
      for (const sellQuote of quotes) {
        if (sellQuote.exchangeId === buyQuote.exchangeId) continue
        const bid = sellQuote.quote.bestBid
        if (!bid) continue
        const spread = bid.price - ask.price
        if (spread <= 0) continue
        const mid = (bid.price + ask.price) / 2
        if (mid <= 0) continue
        const spreadBps = (spread / mid) * BPS_FACTOR
        if (spreadBps < thresholdBps) continue
        let quantity = Math.min(token.tradeSize, ask.size ?? token.tradeSize, bid.size ?? token.tradeSize)
        const buyAdapter = this.exchangeAdapters.get(buyQuote.exchangeId)
        const sellAdapter = this.exchangeAdapters.get(sellQuote.exchangeId)
        if (!buyAdapter || !sellAdapter) continue
        quantity = buyAdapter.normalizeQuantity(buyQuote.symbol, quantity, token)
        quantity = sellAdapter.normalizeQuantity(sellQuote.symbol, quantity, token)
        if (quantity <= 0) continue
        if (!best || spreadBps > best.spreadBps) {
          best = {
            symbol: token.symbol,
            token,
            buyExchangeId: buyQuote.exchangeId,
            sellExchangeId: sellQuote.exchangeId,
            buySymbol: buyQuote.symbol,
            sellSymbol: sellQuote.symbol,
            buyPrice: ask.price,
            sellPrice: bid.price,
            spread,
            spreadBps,
            executableQuantity: quantity,
            timestamp: Date.now()
          }
        }
      }
    }
    return best
  }

  // 对发现的价差同时买卖两边，形成对冲仓位
  private async executeOpportunity(opportunity: SpreadOpportunity): Promise<void> {
    const buyAdapter = this.exchangeAdapters.get(opportunity.buyExchangeId)
    const sellAdapter = this.exchangeAdapters.get(opportunity.sellExchangeId)
    if (!buyAdapter || !sellAdapter) {
      return
    }
    const mid = (opportunity.buyPrice + opportunity.sellPrice) / 2
    const quantity = opportunity.executableQuantity
    const canOpen = this.positionManager.canOpenPosition(opportunity.token, quantity, mid)
    if (!canOpen.allowed) {
      blogger.debug('skip open, position limits', opportunity.symbol, canOpen.reason)
      return
    }

    await Promise.all([
      buyAdapter.ensureLeverage(opportunity.buySymbol, this.settings.leverage),
      sellAdapter.ensureLeverage(opportunity.sellSymbol, this.settings.leverage)
    ])

    const referenceId = `open-${Date.now()}`
    const [buyReport, sellReport] = await Promise.all([
      buyAdapter.placeMarketOrder({
        exchangeId: buyAdapter.id,
        symbol: opportunity.buySymbol,
        side: 'BUY',
        quantity,
        reason: 'OPEN',
        referenceId
      }, opportunity.token),
      sellAdapter.placeMarketOrder({
        exchangeId: sellAdapter.id,
        symbol: opportunity.sellSymbol,
        side: 'SELL',
        quantity,
        reason: 'OPEN',
        referenceId
      }, opportunity.token)
    ])

    if (!buyReport.success || !sellReport.success) {
      blogger.warn('arbitrage execution incomplete', buyReport, sellReport)
      return
    }

    const executedQty = Math.min(buyReport.filledQuantity, sellReport.filledQuantity)
    if (executedQty <= 0) {
      blogger.warn('arbitrage execution zero fill', buyReport, sellReport)
      return
    }

    const entrySpread = ((sellReport.averagePrice - buyReport.averagePrice) / ((sellReport.averagePrice + buyReport.averagePrice) / 2)) * BPS_FACTOR
    const position = this.positionManager.openPosition({
      token: opportunity.token,
      longLeg: buyReport,
      shortLeg: sellReport,
      entrySpreadBps: entrySpread
    })
    blogger.info('opened position', {
      positionId: position.id,
      symbol: position.symbol,
      spreadBps: entrySpread,
      quantity: executedQty
    })
  }

  // 判断是否满足平仓条件并择机减仓
  private async evaluateClosures(token: TokenConfig): Promise<void> {
    const positions = this.positionManager.getOpenPositions().filter((p) => p.symbol === token.symbol)
    if (positions.length === 0) {
      return
    }
    const exchangeQuotes = this.quoteCache.get(token.symbol)
    if (!exchangeQuotes) {
      return
    }
    for (const position of positions) {
      const longQuote = exchangeQuotes.get(position.longLeg.exchangeId)
      const shortQuote = exchangeQuotes.get(position.shortLeg.exchangeId)
      if (!longQuote || !shortQuote) {
        continue
      }
      const sellPrice = longQuote.quote.bestBid?.price
      const buyPrice = shortQuote.quote.bestAsk?.price
      if (!sellPrice || !buyPrice) {
        continue
      }
      const spread = sellPrice - buyPrice
      if (spread <= 0) {
        continue
      }
      const mid = (sellPrice + buyPrice) / 2
      if (mid <= 0) continue
      const spreadBps = (spread / mid) * BPS_FACTOR
      const threshold = this.computeCloseThreshold(token, position)
      if (spreadBps < threshold) {
        continue
      }
      const closeQty = Math.min(token.tradeSize, position.longLeg.remainingQuantity, position.shortLeg.remainingQuantity)
      if (closeQty <= 0) {
        continue
      }
      await this.executeClose(position, closeQty)
    }
  }

  // 根据持仓时长计算动态平仓阈值
  private computeCloseThreshold(token: TokenConfig, position: HedgePosition): number {
    const base = token.closeSpreadBps ?? this.settings.defaultCloseSpreadBps
    const min = token.minCloseSpreadBps ?? this.settings.minCloseSpreadBps
    const decayMinutes = token.closeSpreadDecayMinutes ?? this.settings.closeSpreadDecayMinutes
    if (decayMinutes <= 0) {
      return min
    }
    const heldMinutes = (Date.now() - position.openedAt) / 60000
    const decayFactor = Math.min(heldMinutes / decayMinutes, 1)
    const dynamic = base - (base - min) * decayFactor
    return Math.max(dynamic, min)
  }

  // 执行减仓订单并更新仓位信息
  private async executeClose(position: HedgePosition, quantity: number): Promise<void> {
    const longAdapter = this.exchangeAdapters.get(position.longLeg.exchangeId)
    const shortAdapter = this.exchangeAdapters.get(position.shortLeg.exchangeId)
    if (!longAdapter || !shortAdapter) {
      return
    }

    const token = position.token
    const remaining = Math.min(position.longLeg.remainingQuantity, position.shortLeg.remainingQuantity)
    let closeQty = Math.min(quantity, remaining)
    if (closeQty <= 0) {
      return
    }
    if (closeQty < token.minTradeSize && Math.abs(closeQty - remaining) > 1e-8) {
      // wait for larger chunk to avoid repeated rejection
      return
    }
    if (closeQty < token.minTradeSize) {
      closeQty = remaining
    }

    const referenceId = `close-${position.id}-${Date.now()}`
    const [sellReport, buyReport] = await Promise.all([
      longAdapter.placeMarketOrder({
        exchangeId: longAdapter.id,
        symbol: position.longLeg.symbol,
        side: 'SELL',
        quantity: closeQty,
        reason: 'CLOSE',
        referenceId
      }, token),
      shortAdapter.placeMarketOrder({
        exchangeId: shortAdapter.id,
        symbol: position.shortLeg.symbol,
        side: 'BUY',
        quantity: closeQty,
        reason: 'CLOSE',
        referenceId
      }, token)
    ])

    if (!sellReport.success || !buyReport.success) {
      blogger.warn('close execution incomplete', position.id, sellReport, buyReport)
      return
    }

    const executedQty = Math.min(sellReport.filledQuantity, buyReport.filledQuantity)
    if (executedQty <= 0) {
      return
    }
    const { realizedPnl } = this.positionManager.closePosition({
      position,
      longClose: sellReport,
      shortClose: buyReport,
      quantity: executedQty
    })
    blogger.info('reduced position', {
      positionId: position.id,
      remaining: position.longLeg.remainingQuantity,
      realized: realizedPnl
    })
  }

  // 调用风险模块输出强平信号
  private async evaluateRisk(): Promise<void> {
    const positions = this.positionManager.getOpenPositions()
    if (positions.length === 0) {
      return
    }
    const signals = this.riskManager.evaluate(positions, this.quoteCache)
    for (const signal of signals) {
      if (signal.type !== 'FORCE_REDUCE' || !signal.positionId) {
        continue
      }
      const position = positions.find((p) => p.id === signal.positionId)
      if (!position) continue
      const token = position.token
      const reduceQty = Math.min(token.tradeSize, position.longLeg.remainingQuantity, position.shortLeg.remainingQuantity)
      if (reduceQty <= 0) continue
      const exchangeQuotes = this.quoteCache.get(position.symbol)
      if (!exchangeQuotes) {
        continue
      }
      if (!exchangeQuotes.get(position.longLeg.exchangeId) || !exchangeQuotes.get(position.shortLeg.exchangeId)) {
        continue
      }
      await this.executeClose(position, reduceQty)
    }
  }

  // 生成并输出 NAV 报告
  async publishNav(): Promise<void> {
    if (this.navRunning) {
      blogger.warn('nav job already running, skip trigger')
      return
    }
    this.navRunning = true
    try {
      const priceMap = new Map<string, number>()
      for (const [symbol, exchangeQuotes] of this.quoteCache.entries()) {
        const prices: number[] = []
        exchangeQuotes.forEach((quote) => {
          const bid = quote.quote.bestBid?.price
          const ask = quote.quote.bestAsk?.price
          if (bid && ask) {
            prices.push((bid + ask) / 2)
          } else if (bid) {
            prices.push(bid)
          } else if (ask) {
            prices.push(ask)
          }
        })
        if (prices.length > 0) {
          const avg = prices.reduce((sum, value) => sum + value, 0) / prices.length
          priceMap.set(symbol, avg)
        }
      }
      const summaries = this.positionManager.getNavSnapshot(priceMap)
      const snapshot = buildNavSnapshot(summaries, this.positionManager.getTotalRealizedPnl())
      this.reporter.report(snapshot)
    } catch (error) {
      blogger.error('nav job failed', error)
    } finally {
      this.navRunning = false
    }
  }
}
