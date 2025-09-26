export type ExchangeId = string

export type ExchangeType = 'aster' | 'backpack' | 'mock'

export type TradeSide = 'BUY' | 'SELL'

export interface TokenConfig {
  symbol: string
  base: string
  quote: string
  minTradeSize: number
  tradeSize: number
  maxNetPosition: number
  maxNotionalUsd: number
  openSpreadBps?: number
  closeSpreadBps?: number
  minCloseSpreadBps?: number
  closeSpreadDecayMinutes?: number
  exchangeSymbols: Record<ExchangeId, string>
  instrumentIds?: Record<ExchangeId, number>
}

export interface OrderBookLevel {
  price: number
  size: number
}

export interface OrderBookQuote {
  bestBid?: OrderBookLevel
  bestAsk?: OrderBookLevel
  updatedAt: number
}

export interface ExchangeOrderBookQuote {
  exchangeId: ExchangeId
  symbol: string
  quote: OrderBookQuote
}

export interface SpreadOpportunity {
  symbol: string
  token: TokenConfig
  buyExchangeId: ExchangeId
  sellExchangeId: ExchangeId
  buySymbol: string
  sellSymbol: string
  buyPrice: number
  sellPrice: number
  spread: number
  spreadBps: number
  executableQuantity: number
  timestamp: number
}

export type ExecutionReason = 'OPEN' | 'CLOSE' | 'RISK_REDUCTION'

export interface ExecutionRequest {
  exchangeId: ExchangeId
  symbol: string
  side: TradeSide
  quantity: number
  reason: ExecutionReason
  referenceId?: string
}

export interface ExecutionReport {
  success: boolean
  exchangeId: ExchangeId
  symbol: string
  side: TradeSide
  requestedQuantity: number
  filledQuantity: number
  averagePrice: number
  feePaid: number
  timestamp: number
  referenceId?: string
  error?: string
  raw?: unknown
}

export type PositionStatus = 'OPEN' | 'CLOSING' | 'CLOSED'

export interface PositionLeg {
  exchangeId: ExchangeId
  symbol: string
  side: TradeSide
  quantity: number
  remainingQuantity: number
  averagePrice: number
  leverage: number
  openedAt: number
  lastUpdate: number
}

export interface HedgePosition {
  id: string
  symbol: string
  base: string
  quote: string
  token: TokenConfig
  longLeg: PositionLeg
  shortLeg: PositionLeg
  entrySpreadBps: number
  openedAt: number
  status: PositionStatus
  realizedPnl: number
  lastUpdate: number
  unrealizedPnl?: number
}

export interface PositionExposureSummary {
  symbol: string
  base: string
  totalLong: number
  totalShort: number
  netBase: number
  notionalUsd: number
  unrealizedPnlUsd: number
  realizedPnlUsd: number
  positions: HedgePosition[]
}

export interface RiskSignal {
  type: 'FORCE_REDUCE' | 'ALERT'
  severity: 'INFO' | 'WARN' | 'CRITICAL'
  message: string
  positionId?: string
}

export interface NavSnapshot {
  timestamp: number
  totalRealizedPnlUsd: number
  totalUnrealizedPnlUsd: number
  totalNotionalUsd: number
  positions: PositionExposureSummary[]
}
