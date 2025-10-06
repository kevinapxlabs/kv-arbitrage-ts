import { EExchange } from "../common/exchange.enum.js";

export type TBNKey = {
  apiKey: string
  secret: string
  passPhrase: string
}

export type TKVPosition = {
  exchangeName: EExchange
  symbol: string
  exchangeToken: string
  leverage: string
  positionAmt: string              // 持仓数量
  notional: string                 // 按baseToken计算的持仓价值
}

export type TKVFundingFee = {
  fundingFee: BigNumber
  nextFundingTime: number
}

export type TAsterAccountInfo = {
  initialMarginFraction: number
  marginFraction: number
  equity: string
}

export type TBackpackAccountInfo = {
  imf: number
  mmf: number
  marginFraction: number
  equity: number          // 净权益，不包含已实现盈亏
}

export type TAccountInfo = {
  totalNetEquity: string
  totalPositiveNotional: string    // 正向持仓总价值
  // aster
  asterAccountInfo: TAsterAccountInfo | null
  // backpack
  bpAccountInfo: TBackpackAccountInfo | null
}

export type TQueryOrder = {
  isCompleted: boolean
  result: any
}

export type TCancelOrder = {
  orderId: string
}