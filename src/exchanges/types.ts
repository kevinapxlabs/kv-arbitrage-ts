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

export type TAsterAccountInfo = {
  imr: string
  mmr: string
  equity: string
}

export type TBackpackAccountInfo = {
  imf: string
  mmf: string
  equity: string
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