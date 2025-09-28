import BigNumber from "bignumber.js"
import { TAccountInfo, TKVPosition } from "../exchanges/types.js"
import { TSMap } from "../libs/tsmap.js"

// 按币种维度统计的持仓信息
export type TTokenPosition = {
  notional: string                 // 当前币种在所有交易所持仓总价值的一半，按多单进行计算
  positions: (TKVPosition | null)[]
}

// 按交易所维度统计的持仓信息
export type TExchangeRiskInfo = {
  totalNotional: BigNumber     // 某交易所所有币种持仓总价值，正向持仓价值绝对值 + 负向持仓价值绝对值
  positiveNotional: BigNumber  // 正向持仓总价值，正向持仓价值绝对值
  negativeNotional: BigNumber  // 负向持仓总价值，负向持仓价值绝对值
  positionCounter: number      // 持仓币种数量, 如：ETHUSDT, BTCUSDT, SOLUSDT 三种币种, 则positionCounter为3, 不考虑正向持仓和负向持仓
}

export type TRiskDataInfo = {
  accountInfo: TAccountInfo
  chainTokenPositionMap: TSMap<string, TTokenPosition>
  exchangeRiskInfo: TSMap<string, TExchangeRiskInfo>
}

export type TTokenNotional = {
  chainToken: string
  positionAmt: string
  positiveNotional: string  // 正持仓价值
  negativeNotional: string  // 负持仓价值, 值为正数
}
