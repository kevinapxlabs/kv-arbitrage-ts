import BigNumber from "bignumber.js"
import { EKVSide } from "../common/exchange.enum.js"

export class UtilsMgr {
  /*
  * getSideByPositionAmt: 根据positionAmt获取持仓方向
  * 例如:positionAmt > 0, baseSide做多，返回 EKVSide.LONG
  * 例如:positionAmt < 0, baseSide做空，返回 EKVSide.SHORT
  */
  static getSideByPositionAmt(positionAmt: string): EKVSide {
    return BigNumber(positionAmt).gt(0) ? EKVSide.LONG : EKVSide.SHORT
  }

  /*
  * getPriceDecimal: 根据baseExchange的side计算price decimal
  * @param side: baseExchange的持仓方向
  * @param baseBid1: baseExchange的Bid 1
  * @param baseAsk1: baseExchange的Ask 1
  * @param quoteBid1: quoteExchange的Bid 1
  * @param quoteAsk1: quoteExchange的Ask 1
  */
  static getPriceDelta(side: EKVSide, baseBid1: BigNumber, baseAsk1: BigNumber, quoteBid1: BigNumber, quoteAsk1: BigNumber): number {
    let priceDelta = 0
    // 计算price decimal
    // -减号是指做空合约
    // +加号是指做多合约
    // -A+B的差价计算方式：(A Bid 1 - B Ask 1) / (A Bid 1 + B Ask 1) * 2 * 10000
    // +A-B的差价计算方式：(B Bid 1 - A Ask 1) / (B Bid 1 + A Ask 1) * 2 * 10000
    if (side === EKVSide.LONG) {
      priceDelta = quoteBid1.minus(baseAsk1).div(quoteBid1.plus(baseAsk1)).multipliedBy(2).multipliedBy(10000).toNumber()
    } else {
      priceDelta = baseBid1.minus(quoteAsk1).div(baseBid1.plus(quoteAsk1)).multipliedBy(2).multipliedBy(10000).toNumber()
    }
    return priceDelta
  }
}
