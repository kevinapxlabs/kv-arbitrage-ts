import BigNumber from "bignumber.js"
import { blogger } from "../common/base/logger.js"
import { TRebalanceOrder } from "../common/types/exchange.type.js"
import { TKVPosition } from "../exchanges/types.js"
import { TRiskDataInfo } from "./type.js"
import { EKVSide, EOrderReason } from "../common/exchange.enum.js"
import { sendMsg } from "../utils/bot.js"
import { ParamsMgr } from "./params.js"
import { ExchangeIndexMgr } from "./exchange.index.js"
import { ArbitrageBase } from "./base.js"
import { calculateValidQuantity } from "../utils/utils.js"
import { ExchangeDataMgr } from "./exchange.data.js"
import { OrderTakerMgr } from "./order.taker.js"
import { TArbitrageConfig } from "./arbitrage.config.js"
import { TExchangeTokenInfo, TokenInfoService } from "../service/tokenInfo.service.js"
import { TSMap } from "../libs/tsmap.js"
import { ExchangeAdapter } from "../exchanges/exchange.adapter.js"
import { TokenQtyMgr } from "./token.qty.js"

type TPositionSummary = {
  longSize: BigNumber
  shortSize: BigNumber
  longIndex?: number
  shortIndex?: number
}

export class RebalanceMgr extends ArbitrageBase {
  exchangeIndexMgr: ExchangeIndexMgr
  arbitrageConfig: TArbitrageConfig
  exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  private readonly tokenQtyMgr: TokenQtyMgr

  constructor(traceId: string, exchangeIndexMgr: ExchangeIndexMgr, arbitrageConfig: TArbitrageConfig, exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>) {
    super(`${traceId} rebalance`)
    this.exchangeIndexMgr = exchangeIndexMgr
    this.arbitrageConfig = arbitrageConfig
    this.exchangeTokenInfoMap = exchangeTokenInfoMap
    this.tokenQtyMgr = new TokenQtyMgr(this.traceId, this.exchangeIndexMgr)
  }

  async toTg(rebalanceOrders: TRebalanceOrder[]) {
    if (rebalanceOrders.length === 0) {
      return
    }
    const texts = ['【通知主题】: 平衡交易所仓位']
    for(const item of rebalanceOrders) {
      texts.push(`【${item.exchange}】: ${item.symbol}`)
      texts.push(`【Side】: ${item.side}(${item.exchange})`)
      texts.push(`【Quantity】: ${item.quantity}`)
    }
    texts.push(`【Mark】: ${this.traceId}`)
    const content = texts.join('\n')
    // console.log(content)
    await sendMsg(ParamsMgr.TG_NOTICE_NAME, content)
  }

  async rebalance(chainToken: string, positions: (TKVPosition | null)[]): Promise<TRebalanceOrder | undefined> {
    const positionSummary = this.summarizePositions(positions)
    if (!positionSummary) {
      return
    }
    const { longSize, shortSize, longIndex, shortIndex } = positionSummary
    let exchange: ExchangeAdapter | undefined
    let side: EKVSide | undefined
    let diffSize = BigNumber(0)
    let exchangePositionAmt = BigNumber(0)
    if (longSize.gt(shortSize)) {
      diffSize = longSize.minus(shortSize)
      side = EKVSide.SHORT
      if (longIndex !== undefined) {
        exchange = this.exchangeIndexMgr.exchangeList[longIndex]
        exchangePositionAmt = BigNumber(positions[longIndex]?.positionAmt ?? 0)
      }
    } else if (shortSize.gt(longSize)) {
      diffSize = shortSize.minus(longSize)
      side = EKVSide.LONG
      if (shortIndex !== undefined) {
        exchange = this.exchangeIndexMgr.exchangeList[shortIndex]
        exchangePositionAmt = BigNumber(positions[shortIndex]?.positionAmt ?? 0)
      }
    }
    if (exchange && side && diffSize.gt(0)) {
      // 4. 检查是否taker单下单数量太大，最大下单数量按 REBLANCE_MAX_USD_AMOUNT 进行计算
      const indexPrice = await this.getExchangeDataMgr().getIndexPrice2(this.exchangeIndexMgr.exchangeList, chainToken, this.exchangeTokenInfoMap)
      if (!indexPrice) {
        blogger.error(`${this.traceId} chainToken: ${chainToken}, rebalance failed, no index price`)
        return
      }
      let quantity = BigNumber(this.arbitrageConfig.REBALANCE_MAX_USD_AMOUNT).dividedBy(indexPrice)
      if (diffSize.gt(quantity)) {
        const qtyDec = await this.tokenQtyMgr.getMinQtyDecimal(chainToken, this.exchangeTokenInfoMap)
        if (!qtyDec) {
          blogger.error(`${this.traceId} chainToken: ${chainToken}, rebalance failed, no qty decimal`)
          return
        }
        const quantity1 = calculateValidQuantity(quantity, qtyDec.minQty, qtyDec.stepSize, null)
        diffSize = BigNumber(quantity1)
      }
      const orderTakerMgr = new OrderTakerMgr(this.traceId, EOrderReason.REBALANCE)
      const key = TokenInfoService.getExchangeTokenKey(exchange.exchangeName, chainToken)
      const exchangeInfo = this.exchangeTokenInfoMap.get(key)
      if (!exchangeInfo) {
        blogger.error(`${this.traceId} chainToken: ${chainToken}, rebalance failed, no exchange info, key: ${key}`)
        return
      }
      if (diffSize.gt(exchangePositionAmt.abs())) {
        blogger.warn(`${this.traceId} chainToken: ${chainToken}, rebalance quantity is too large, diffSize: ${diffSize} > exchangePositionAmt: ${exchangePositionAmt.abs()}`)
        diffSize = exchangePositionAmt.abs()
      }
      const symbol = exchange.generateExchangeSymbol(exchangeInfo.exchangeTokenInfo.exchangeToken)
      await orderTakerMgr.createOrder(exchange, symbol, side, diffSize.toString(), true)
      return {
        exchange: exchange.exchangeName,
        symbol: exchangeInfo.exchangeTokenInfo.exchangeToken,
        side,
        quantity: diffSize.toString()
      }
    }
  }

  // 返回是否需要rebalance
  async rebalances(riskData: TRiskDataInfo): Promise<boolean> {
    const riskDataKeys = riskData.chainTokenPositionMap.keys()
    blogger.info(`${this.traceId} riskDataKeys length: ${riskDataKeys.length}`)
    if (riskDataKeys.length > 0) {
      const promises = []
      for(const chainToken of riskDataKeys) {
        const chainTokenPosition = riskData.chainTokenPositionMap.get(chainToken)
        if (chainTokenPosition) {
          promises.push(this.rebalance(chainToken, chainTokenPosition.positions))
        }
      }
      const rebalanceOrders = await Promise.all(promises)
      const validRebalanceOrders = rebalanceOrders.filter(item => item !== undefined) as TRebalanceOrder[]
      blogger.info(`${this.traceId} rebalance valid orders: ${JSON.stringify(validRebalanceOrders)}`)
      await this.toTg(validRebalanceOrders)
      if (validRebalanceOrders.length > 0) {
        return true
      }
    }
    return false
  }

  private summarizePositions(positions: (TKVPosition | null)[]): TPositionSummary | undefined {
    let longSize = BigNumber(0)
    let shortSize = BigNumber(0)
    let longIndex: number | undefined
    let shortIndex: number | undefined
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i]
      if (!position) {
        continue
      }
      const positionAmt = BigNumber(position.positionAmt)
      if (positionAmt.isZero()) {
        continue
      }
      if (positionAmt.lt(0)) {
        shortSize = shortSize.plus(positionAmt.abs())
        if (shortIndex === undefined) {
          shortIndex = i
        }
      } else {
        longSize = longSize.plus(positionAmt)
        if (longIndex === undefined) {
          longIndex = i
        }
      }
    }
    if (longSize.isZero() && shortSize.isZero()) {
      return undefined
    }
    return {
      longSize,
      shortSize,
      longIndex,
      shortIndex
    }
  }
}
