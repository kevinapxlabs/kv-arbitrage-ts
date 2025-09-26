import { ExecutionRequest, ExecutionReport, ExchangeId, ExchangeType } from '../types.js'
import { TokenConfig } from '../types.js'

export interface ExchangeAccountLimits {
  minQuantity?: number
  quantityStep?: number
}

// 定义具体交易所适配器需要实现的能力
export interface ExchangeAdapter {
  readonly id: ExchangeId
  readonly type: ExchangeType
  readonly settlementAsset?: string
  setup?(): Promise<void>
  ensureLeverage(symbol: string, leverage: number): Promise<void>
  normalizeQuantity(symbol: string, quantity: number, token: TokenConfig): number
  placeMarketOrder(request: ExecutionRequest, token: TokenConfig): Promise<ExecutionReport>
}

// 按步长向下取整，避免超过交易所精度限制
export const roundQuantity = (quantity: number, step = 0.0001): number => {
  if (step <= 0) {
    return quantity
  }
  const precision = Math.round(1 / step)
  return Math.floor(quantity * precision) / precision
}
