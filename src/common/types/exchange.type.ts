import { ExchangeAdapter } from "../../exchanges/exchange.adapter"
import { EExchange, EKVSide } from "../exchange.enum"

// 交易系统订单簿数据结构
export type TExchangeOrderbook = {
  updatetime: number    // 更新时间
  bids: string[][]      // 买单
  asks: string[][]      // 卖单
}

// 资费数据
export type TExchangeFundingFee = {
  rate: string               // 资费，如0.0001
  nextFundingTime: number,   // 下轮资费时间戮 ms, 如1717171717171
  updatetime: number         // 行情生成时的时间戮 s
}

export type TExchangeMarkprice = {
  indexPrice: string    // 指数价格
  markPrice: string     // 标记价格
  rate: string,         // 接下来要收取的资费  0.0001
  nextFundingTime: number,   // 下轮资费时间戮 ms
  updatetime: number                 // 行情生成时的时间戮  ms
}

// 下单参数
export type TOrderParams = {
  chainToken: string                // 合约币种名称，如PEPE, ETH, USDT
  baseExchange: ExchangeAdapter    // base交易所服务
  baseExchangeToken: string         // base交易所币种名称，如1000PEPE, 1000ETH, 1000USDT
  quoteExchange: ExchangeAdapter   // quote交易所服务
  quoteExchangeToken: string        // quote交易所币种名称，如KPEPE, KETH, KUSDT
  quantity: string                  // 下单数量
  side: EKVSide                     // base 下单方向，如LONG, SHORT
}

export type TRebalanceOrder = {
  exchange: EExchange
  symbol: string
  side: EKVSide
  quantity: string
}

// 资费数据
export type TCoinData = {
  chainToken: string             // 合约币种名称，如PEPE, ETH, USDT
  baseExchange: EExchange           // 交易所名称，如BINANCE, BYBIT, BITGET
  baseExchangeIndex: number     // 交易所索引，如0, 1, 2
  baseExchangeRate: BigNumber   // 交易所资费
  baseExchangeToken: string     // 交易所币种信息，如1000PEPE
  quoteExchange: EExchange      // 交易所名称，如BINANCE, BYBIT, BITGET
  quoteExchangeIndex: number    // 交易所索引，如0, 1, 2
  quoteExchangeRate: BigNumber   // 交易所资费
  quoteExchangeToken: string     // 交易所币种信息，如KPEPE
  total: BigNumber               // 资费差值
}

// token qty
export type TTokenQty = {
  minQty: string
  stepSize: string
}

export enum EPositionDescrease {
  None = 0,
  Decrease = 2,
  DecreasePercent = 3
}
