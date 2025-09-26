import { ArbitrageRuntimeConfig } from '../../config/config.js'
import { blogger } from '../../common/base/logger.js'
import { ExecutionReport, HedgePosition, PositionExposureSummary, PositionLeg, TokenConfig } from '../types.js'

interface OpenPositionParams {
  token: TokenConfig
  longLeg: ExecutionReport
  shortLeg: ExecutionReport
  entrySpreadBps: number
}

interface CloseLegInput {
  position: HedgePosition
  longClose: ExecutionReport
  shortClose: ExecutionReport
  quantity: number
}

const EPSILON = 1e-8

// 跟踪双边仓位，负责开仓、减仓及净敞口统计
export class PositionManager {
  private readonly positions: HedgePosition[] = []
  private totalRealizedPnl = 0

  constructor(private readonly settings: ArbitrageRuntimeConfig) {}

  // 检查是否满足开仓限制（数量、名义资金、仓位数量）
  canOpenPosition(token: TokenConfig, quantity: number, midPrice: number): { allowed: boolean; reason?: string } {
    const exposure = this.getExposureSummary(token.symbol)
    // Hedge positions open delta neutral; ensure per-leg limit separately
    const projectedLong = (exposure?.totalLong ?? 0) + quantity
    const projectedShort = (exposure?.totalShort ?? 0) + quantity
    const tokenMaxPosition = token.maxNetPosition
    if (projectedLong > tokenMaxPosition || projectedShort > tokenMaxPosition) {
      return { allowed: false, reason: 'max position exceeded' }
    }
    const tokenMaxNotional = token.maxNotionalUsd
    const notional = quantity * midPrice
    const projectedNotional = (exposure?.notionalUsd ?? 0) + notional
    if (projectedNotional > tokenMaxNotional) {
      return { allowed: false, reason: 'token notional limit exceeded' }
    }
    const openPositions = this.positions.filter((p) => p.status !== 'CLOSED').length
    if (openPositions >= this.settings.maxSimultaneousPositions) {
      return { allowed: false, reason: 'max simultaneous positions reached' }
    }
    return { allowed: true }
  }

  // 记录一笔新的对冲仓位
  openPosition(params: OpenPositionParams): HedgePosition {
    const longQty = params.longLeg.filledQuantity
    const shortQty = params.shortLeg.filledQuantity
    const quantity = Math.min(longQty, shortQty)
    if (quantity <= EPSILON) {
      throw new Error('cannot open position with zero quantity')
    }
    if (Math.abs(longQty - shortQty) > EPSILON) {
      blogger.warn('position imbalance detected', params.token.symbol, longQty, shortQty)
    }

    const now = Date.now()
    const position: HedgePosition = {
      id: `${params.token.symbol}-${now}`,
      symbol: params.token.symbol,
      base: params.token.base,
      quote: params.token.quote,
      token: params.token,
      longLeg: this.createLeg(params.longLeg, quantity, now),
      shortLeg: this.createLeg(params.shortLeg, quantity, now),
      entrySpreadBps: params.entrySpreadBps,
      openedAt: now,
      status: 'OPEN',
      realizedPnl: 0,
      lastUpdate: now
    }
    this.positions.push(position)
    return position
  }

  // 处理平仓成交并更新盈亏
  closePosition(params: CloseLegInput): { position: HedgePosition; realizedPnl: number } {
    const { position, quantity } = params
    if (quantity <= EPSILON) {
      throw new Error('close quantity must be positive')
    }
    const available = Math.min(position.longLeg.remainingQuantity, position.shortLeg.remainingQuantity)
    const closingQty = Math.min(quantity, available)
    if (closingQty <= EPSILON) {
      throw new Error('no quantity available to close')
    }

    const longPnl = (params.longClose.averagePrice - position.longLeg.averagePrice) * closingQty
    const shortPnl = (position.shortLeg.averagePrice - params.shortClose.averagePrice) * closingQty
    const realized = longPnl + shortPnl

    position.longLeg.remainingQuantity = Math.max(position.longLeg.remainingQuantity - closingQty, 0)
    position.shortLeg.remainingQuantity = Math.max(position.shortLeg.remainingQuantity - closingQty, 0)
    position.realizedPnl += realized
    this.totalRealizedPnl += realized
    position.lastUpdate = Date.now()
    if (position.longLeg.remainingQuantity <= EPSILON && position.shortLeg.remainingQuantity <= EPSILON) {
      position.status = 'CLOSED'
    } else {
      position.status = 'CLOSING'
    }
    return { position, realizedPnl: realized }
  }

  // 获取当前仍未完全平掉的仓位
  getOpenPositions(): HedgePosition[] {
    return this.positions.filter((p) => p.status !== 'CLOSED')
  }

  // 返回所有历史仓位
  getAllPositions(): HedgePosition[] {
    return [...this.positions]
  }

  // 统计某个币种的仓位敞口信息
  getExposureSummary(symbol: string): PositionExposureSummary | undefined {
    const positions = this.positions.filter((p) => p.symbol === symbol && p.status !== 'CLOSED')
    if (positions.length === 0) {
      return undefined
    }
    let totalLong = 0
    let totalShort = 0
    let notionalUsd = 0
    positions.forEach((p) => {
      totalLong += p.longLeg.remainingQuantity
      totalShort += p.shortLeg.remainingQuantity
      const midPrice = (p.longLeg.averagePrice + p.shortLeg.averagePrice) / 2
      notionalUsd += midPrice * Math.min(p.longLeg.remainingQuantity, p.shortLeg.remainingQuantity)
    })
    return {
      symbol,
      base: positions[0].base,
      totalLong,
      totalShort,
      netBase: totalLong - totalShort,
      notionalUsd,
      unrealizedPnlUsd: 0,
      realizedPnlUsd: positions.reduce((sum, p) => sum + p.realizedPnl, 0),
      positions
    }
  }

  // 获取累计已实现盈亏
  getTotalRealizedPnl(): number {
    return this.totalRealizedPnl
  }

  // 根据最新价格计算每个仓位的未实现盈亏
  calculateUnrealizedPnl(quotes: Map<string, number>): void {
    this.positions.forEach((position) => {
      const midPrice = quotes.get(position.symbol)
      if (!midPrice) {
        return
      }
      const longPnl = (midPrice - position.longLeg.averagePrice) * position.longLeg.remainingQuantity
      const shortPnl = (position.shortLeg.averagePrice - midPrice) * position.shortLeg.remainingQuantity
      position.lastUpdate = Date.now()
      position.unrealizedPnl = longPnl + shortPnl
    })
  }

  // 生成 NAV 报告所需的仓位快照
  getNavSnapshot(quotes: Map<string, number>): PositionExposureSummary[] {
    const snapshots: PositionExposureSummary[] = []
    const grouped = new Map<string, PositionExposureSummary>()
    this.calculateUnrealizedPnl(quotes)
    this.positions.forEach((position) => {
      if (position.status === 'CLOSED') {
        return
      }
      const midPrice = quotes.get(position.symbol) ?? (position.longLeg.averagePrice + position.shortLeg.averagePrice) / 2
      const existing = grouped.get(position.symbol)
      const pairedQty = Math.min(position.longLeg.remainingQuantity, position.shortLeg.remainingQuantity)
      const unrealized = position.unrealizedPnl ?? 0
      if (!existing) {
        grouped.set(position.symbol, {
          symbol: position.symbol,
          base: position.base,
          totalLong: position.longLeg.remainingQuantity,
          totalShort: position.shortLeg.remainingQuantity,
          netBase: position.longLeg.remainingQuantity - position.shortLeg.remainingQuantity,
          notionalUsd: midPrice * pairedQty,
          unrealizedPnlUsd: unrealized,
          realizedPnlUsd: position.realizedPnl,
          positions: [position]
        })
      } else {
        existing.totalLong += position.longLeg.remainingQuantity
        existing.totalShort += position.shortLeg.remainingQuantity
        existing.netBase = existing.totalLong - existing.totalShort
        existing.notionalUsd += midPrice * pairedQty
        existing.unrealizedPnlUsd += unrealized
        existing.realizedPnlUsd += position.realizedPnl
        existing.positions.push(position)
      }
    })
    grouped.forEach((value) => snapshots.push(value))
    return snapshots
  }

  // 生成仓位腿信息，便于后续更新与统计
  private createLeg(report: ExecutionReport, quantity: number, timestamp: number): PositionLeg {
    return {
      exchangeId: report.exchangeId,
      symbol: report.symbol,
      side: report.side,
      quantity,
      remainingQuantity: quantity,
      averagePrice: report.averagePrice,
      leverage: this.settings.leverage,
      openedAt: timestamp,
      lastUpdate: timestamp
    }
  }
}
