import { EExchange } from "../common/exchange.enum.js";

export type TKVPosition = {
  exchangeName: EExchange
  symbol: string
  exchangeToken: string
  leverage: string
  positionAmt: string              // 持仓数量
  notional: string                 // 按baseToken计算的持仓价值
}

export type TBNAccountInfo = {
  initialMarginFraction: number
  marginFraction: number
  equity: string
  cashBalance: string                 // 跟交易所的现金借贷余额，若为正，表示赚取的资费，若为负，表示向交易所借贷金额
  marginBalance: string               // marginBalance = walletBalance + unrealizedProfit
  basedAssetBalance: string          // 资费收益资产数量，币本位计，例如 USDT本位, BTC本位
}

export type TBybitAccountInfo = {
  imr: string
  mmr: string
  initialMargin: string
  equity: string
  cashBalance: string                 // 跟交易所的现金借贷余额，若为正，表示赚取的资费，若为负，表示向交易所借贷金额
  marginBalance: string               // marginBalance = walletBalance + unrealizedProfit
  basedAssetBalance: string          // 资费收益资产数量，币本位计，例如 USDT本位, BTC本位
}

export type TBitgetAccountInfo = {
  unionAvailable: string
  unionTotalMargin: string
  unionMMR: string
  equity: string
  cashBalance: string                 // 跟交易所的现金借贷余额，若为正，表示赚取的资费，若为负，表示向交易所借贷金额
  marginBalance: string               // marginBalance = walletBalance + unrealizedProfit
  basedAssetBalance: string          // 资费收益资产数量，币本位计，例如 USDT本位, BTC本位
}

export type TLTPBNAccountInfo = {
  uniMMR: string
  mmr: string
  equity: string
  marginValue: string
  maintainMargin: string
  availableMargin: string
  cashBalance: string                 // 跟交易所的现金借贷余额，若为正，表示赚取的资费，若为负，表示向交易所借贷金额
  marginBalance: string               // marginBalance = walletBalance + unrealizedProfit
  basedAssetBalance: string          // 资费收益资产数量，币本位计，例如 USDT本位, BTC本位
}

export type TAccountInfo = {
  totalNetEquity: string
  totalPositiveNotional: string    // 正向持仓总价值
  // binance
  bnAccountInfo: TBNAccountInfo | null
  // bybit
  bybitAccountInfo: TBybitAccountInfo | null
  // bitget
  bitgetAccountInfo: TBitgetAccountInfo | null
  // ltp
  ltpBNAccountInfo: TLTPBNAccountInfo | null
}

export type TQueryOrder = {
  isCompleted: boolean
  result: any
}

export type TCancelOrder = {
  orderId: string
}