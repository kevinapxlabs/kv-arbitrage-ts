import { EExchange, EExchangeId, EKVSide } from '../common/exchange.enum.js'
import { TQtyFilter } from '../manager/marketinfo/maretinfo.type.js'
import { TAccountInfo, TCancelOrder, TKVPosition, TQueryOrder } from './types.js'

export interface ExchangeAccountLimits {
  minQuantity?: number
  quantityStep?: number
}

// 定义具体交易所适配器需要实现的能力
export interface ExchangeAdapter {
  readonly id: EExchangeId
  readonly exchangeName: EExchange
  readonly settlementAsset: string
  /* 生成本交易所币对
    @param exchangeToken: 交易所币对
    @returns 交易所币对，如 BINANCE_PERP_BTCUSDT_USDT
  */
  generateExchangeSymbol(exchangeToken: string): string

  /* 生成交易所币对，用于获取订单簿，从缓存中获取
    @param exchangeToken: 交易所币对
    @returns 交易所币对，如 BTCUSDT
  */
  generateOrderbookSymbol(exchangeToken: string): string

  /*
    @param symbol: 交易所符号, 如 BTCUSDT
    @returns 基础货币 如 BTC
  */
  getExchangeToken(symbol: string): string

  getAccountInfo(): Promise<TAccountInfo>
  // 获取交易所持仓信息
  getPositions(): Promise<TKVPosition[]>
  ensureLeverage(symbol: string, leverage: number): Promise<void>
  /* 获取下单数量条件
    @param symbol: 交易所符号 如 BTCUSDT
    @returns 下单数量条件
  */
  getQtyFilter(symbol: string): Promise<TQtyFilter | undefined>
  placeMarketOrder(symbol: string, side: EKVSide, quantity: string): Promise<string>
  placeLimitOrder(symbol: string, side: EKVSide, quantity: string, price: string): Promise<string>
  queryOrder(symbol: string, orderId: string): Promise<TQueryOrder>
  cancelOrder(symbol: string, orderId: string): Promise<TCancelOrder>
}

// 按步长向下取整，避免超过交易所精度限制
export const roundQuantity = (quantity: number, step = 0.0001): number => {
  if (step <= 0) {
    return quantity
  }
  const precision = Math.round(1 / step)
  return Math.floor(quantity * precision) / precision
}
