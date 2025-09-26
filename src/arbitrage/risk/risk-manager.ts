import { ArbitrageRuntimeConfig } from '../../config/config.js'
import { blogger } from '../../common/base/logger.js'
import { ExchangeOrderBookQuote, HedgePosition, RiskSignal } from '../../exchanges/types.js'

const BPS_FACTOR = 10000

export type QuoteMapPerSymbol = Map<string, Map<string, ExchangeOrderBookQuote>>

// 依据行情与仓位状态输出风险信号
export class RiskManager {
  constructor(private readonly settings: ArbitrageRuntimeConfig) {}

  // 检查每个仓位的亏损、持仓时间及对冲偏差
  evaluate(
    positions: HedgePosition[],
    quotes: QuoteMapPerSymbol
  ): RiskSignal[] {
    const signals: RiskSignal[] = []
    const now = Date.now()
    for (const position of positions) {
      const exchangeQuotes = quotes.get(position.symbol)
      if (!exchangeQuotes) {
        continue
      }
      const longQuote = exchangeQuotes.get(position.longLeg.exchangeId)
      const shortQuote = exchangeQuotes.get(position.shortLeg.exchangeId)
      if (!longQuote || !shortQuote) {
        continue
      }
      const longBid = longQuote.quote.bestBid?.price ?? longQuote.quote.bestAsk?.price
      const shortAsk = shortQuote.quote.bestAsk?.price ?? shortQuote.quote.bestBid?.price
      if (!longBid || !shortAsk) {
        continue
      }

      const durationMinutes = (now - position.openedAt) / 60000
      if (durationMinutes > this.settings.maxHoldingMinutes) {
        signals.push({
          type: 'FORCE_REDUCE',
          severity: 'WARN',
          message: `holding time ${durationMinutes.toFixed(1)}m exceeds limit`,
          positionId: position.id
        })
      }

      const longLoss = Math.max(0, (position.longLeg.averagePrice - longBid) * position.longLeg.remainingQuantity)
      const shortLoss = Math.max(0, (shortAsk - position.shortLeg.averagePrice) * position.shortLeg.remainingQuantity)
      const longMargin = (position.longLeg.averagePrice * position.longLeg.remainingQuantity) / this.settings.leverage
      const shortMargin = (position.shortLeg.averagePrice * position.shortLeg.remainingQuantity) / this.settings.leverage
      if (longMargin > 0 && longLoss / longMargin > this.settings.risk.maxMarginLossRatio) {
        signals.push({
          type: 'FORCE_REDUCE',
          severity: 'CRITICAL',
          message: 'long leg loss exceeds margin buffer',
          positionId: position.id
        })
      }
      if (shortMargin > 0 && shortLoss / shortMargin > this.settings.risk.maxMarginLossRatio) {
        signals.push({
          type: 'FORCE_REDUCE',
          severity: 'CRITICAL',
          message: 'short leg loss exceeds margin buffer',
          positionId: position.id
        })
      }

      const currentSpread = ((shortAsk - longBid) / ((shortAsk + longBid) / 2)) * BPS_FACTOR
      if (currentSpread < this.settings.risk.forceCloseSpreadBps) {
        signals.push({
          type: 'FORCE_REDUCE',
          severity: 'WARN',
          message: `spread reversal ${currentSpread.toFixed(2)}bps`,
          positionId: position.id
        })
      }

      const longNotional = longBid * position.longLeg.remainingQuantity
      const shortNotional = shortAsk * position.shortLeg.remainingQuantity
      if (longNotional + shortNotional > 0) {
        const imbalanceRatio = Math.abs(longNotional - shortNotional) / ((longNotional + shortNotional) / 2)
        const imbalanceBps = imbalanceRatio * BPS_FACTOR
        if (imbalanceBps > this.settings.risk.maxHedgeImbalanceBps) {
          signals.push({
            type: 'FORCE_REDUCE',
            severity: 'INFO',
            message: `hedge imbalance ${imbalanceBps.toFixed(2)}bps`,
            positionId: position.id
          })
        }
      }
    }
    if (signals.length > 0) {
      blogger.warn('risk manager signals', signals)
    }
    return signals
  }
}
