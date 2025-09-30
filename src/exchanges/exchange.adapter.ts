import { TRiskDataInfo } from '../arbitrage/type.js'
import { EExchange, EExchangeCexId, EExchangeId, EKVSide } from '../common/exchange.enum.js'
import { EPositionDescrease } from '../common/types/exchange.type.js'
import { TQtyFilter } from '../manager/marketinfo/maretinfo.type.js'
import { TAccountInfo, TCancelOrder, TKVPosition, TQueryOrder } from './types.js'

export interface ExchangeAccountLimits {
  minQuantity?: number
  quantityStep?: number
}

// 定义具体交易所适配器需要实现的能力
export interface ExchangeAdapter {
  readonly traceId: string
  readonly exchangeId: EExchangeId   // 交易所ID, 用于区分交易所，如LTP_BINANCE, BINANCE 是不同的交易所， 但cexId是相同的
  readonly cexId: EExchangeCexId     // 交易所CexID, 用于获取订单薄信息等
  readonly exchangeName: EExchange  // 交易所名称
  readonly settlementAsset: string  // 结算资产

  /* 检查是否需要加仓
    @param riskData: 风险数据
    @returns 是否需要加仓 true: 需要加仓, false: 不需要加仓
  */
  isIncrease(riskData: TRiskDataInfo): boolean

  // 检查是否需要减仓
  isDecrease(riskData: TRiskDataInfo): EPositionDescrease

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

  // 获取交易所账户信息
  getAccountInfo(): Promise<TAccountInfo>
  // 获取交易所持仓信息
  getPositions(): Promise<TKVPosition[]>
  ensureLeverage(symbol: string, leverage: number): Promise<void>
  /* 获取下单数量条件
    @param symbol: 交易所符号 如 BTCUSDT
    @returns 下单数量条件
  */
  getQtyFilter(symbol: string): Promise<TQtyFilter | undefined>
  // 下市价单
  placeMarketOrder(symbol: string, side: EKVSide, quantity: string, reduceOnly: boolean): Promise<string>
  // 下限价单
  placeLimitOrder(symbol: string, side: EKVSide, quantity: string, price: string, reduceOnly: boolean): Promise<string>
  // 查询订单
  queryOrder(symbol: string, orderId: string): Promise<TQueryOrder>
  // 取消订单
  cancelOrder(symbol: string, orderId: string): Promise<TCancelOrder>
  /*
    @param symbol: 交易所符号 如 BTCUSDT
    @returns 当前资费数据
  */
  getCurrentFundingFee(symbol: string): Promise<BigNumber>

   /*
    @param symbol: 交易所符号 如 BTCUSDT
    @returns 资费间隔时间
  */
  getSymbolInterval(symbol: string): Promise<number>
}
