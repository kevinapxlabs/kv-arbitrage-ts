import BigNumber from "bignumber.js"
import { blogger } from "../common/base/logger.js"
import { EKVSide, EOrderReason } from "../common/exchange.enum.js"
import { TCoinData, TOrderParams } from "../common/types/exchange.type.js"
import { TKVPosition } from "../exchanges/types.js"
import { ArbitrageBase } from "./base.js"
import { TokenQtyMgr } from "./token.qty.js"
import { ExchangeIndexMgr } from "./exchange.index.js"
import { NoticeMgr } from "./notice.js"
import { OrderTakerMgr } from "./order.taker.js"
import { ParamsMgr } from "./params.js"
import { TRiskDataInfo } from "./type.js"
import { UtilsMgr } from "./utils.js"
import { calculateValidQuantity } from "../utils/utils.js"
import { ExchangeDataMgr } from "./exchange.data.js"
import { sendMsg } from "../utils/bot.js"
import { TArbitrageConfig } from "./arbitrage.config.js"
import { TSMap } from "../libs/tsmap.js"
import { TExchangeTokenInfo } from "../service/tokenInfo.service.js"

export class DecreaseMgr extends ArbitrageBase {
  exchangeIndexMgr: ExchangeIndexMgr
  arbitrageConfig: TArbitrageConfig
  exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>

  constructor(traceId: string, exchangeIndexMgr: ExchangeIndexMgr, arbitrageConfig: TArbitrageConfig, exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>) {
    super(traceId)
    this.exchangeIndexMgr = exchangeIndexMgr
    this.arbitrageConfig = arbitrageConfig
    this.exchangeTokenInfoMap = exchangeTokenInfoMap
  }

  async toTg(orderParams: TOrderParams[]) {
    const texts = ['【通知主题】: 风控减仓']
    for(let i = 0; i < orderParams.length; i++) {
      const item = orderParams[i]
      let side: string
      if (item.side === EKVSide.LONG) {
        side = 'BUY'
      } else {
        side = 'SELL'
      }
      texts.push(`【${item.chainToken}】: ${item.quantity}`)
      texts.push(`【Side】: ${side}(${item.baseExchange.exchangeName}|${item.quoteExchange.exchangeName})`)
    }
    texts.push(`【Mark】: ${this.traceId}`)
    const content = texts.join('\n')
    await sendMsg(ParamsMgr.TG_NOTICE_NAME, content)
  }

  /**
   * 减仓
   * @param baseExchangePosition
   * @param feeData
   * @param percent
   * @returns
   */
  async _decreasePosition(
    trace2: string,
    btPosition: TKVPosition,
    qtPosition: TKVPosition,
    feeData: TCoinData,
    percent?: number
  ): Promise<TOrderParams | undefined> {
    const chainToken = feeData.chainToken
    let quantity: BigNumber
    const positionAmt = btPosition.positionAmt
    // 1. 如果持仓方向相同，则不减仓
    if (BigNumber(positionAmt).multipliedBy(qtPosition.positionAmt).gte(0)) {
      // 如果持仓方向相反，则不减仓
      blogger.info(`${this.traceId} ${trace2}, btPosition: ${btPosition.positionAmt}, qtPosition: ${qtPosition.positionAmt}, position is the same, not decrease position`)
      return
    }
    const positionAmtAbs = BigNumber(positionAmt).abs()
    // 减仓时与持仓方向相反
    const currentSide = UtilsMgr.getSideByPositionAmt(positionAmt)
    const side = currentSide === EKVSide.LONG ? EKVSide.SHORT : EKVSide.LONG

    // 2. 获取orderbook
    const baseExchange = this.exchangeIndexMgr.exchangeList[feeData.baseExchangeIndex]
    const quoteExchange = this.exchangeIndexMgr.exchangeList[feeData.quoteExchangeIndex]
    const baseExchangeToken = feeData.baseExchangeToken
    const quoteExchangeToken = feeData.quoteExchangeToken
    const baseSymbol = baseExchange.generateOrderbookSymbol(baseExchangeToken)
    const exchangeDataMgr = new ExchangeDataMgr(this.traceId)
    const orderbook = await exchangeDataMgr.getOrderBook(baseExchange.exchangeName, baseSymbol)
    if (!orderbook) {
      blogger.info(`${this.traceId} ${trace2}, orderbook ${baseSymbol} not found, exchange: ${feeData.baseExchange}`)
      return
    }
    const price = side === EKVSide.LONG ? orderbook.bids[0][0] : orderbook.asks[0][0]
    // 3. 获取交易所下单限制数据
    const tokenQtyMgr = new TokenQtyMgr(this.traceId, this.exchangeIndexMgr)
    const tokenQty = await tokenQtyMgr.getMinQtyDecimal(chainToken, this.exchangeTokenInfoMap)
    if (!tokenQty) {
      blogger.info(`${this.traceId} ${trace2}, no token qty, not decrease position`)
      return
    }
    // 4. 非激烈减仓时，需要判断价格差
    if (!percent) {
      const priceDelta = await this.getPriceDelta(trace2, side, baseExchangeToken, baseExchange, quoteExchangeToken, quoteExchange)
      if (!priceDelta) {
        blogger.error(`${this.traceId} ${trace2}, decrease position failed, no price decimal`)
        return
      }
      // 价格差小于阈值，则不减仓
      if (priceDelta < this.arbitrageConfig.DECREASE_PRICE_DELTA_BPS) {
        blogger.info(`${this.traceId} ${trace2}, decrease position failed, price delta: ${priceDelta} less than ${this.arbitrageConfig.DECREASE_PRICE_DELTA_BPS}`)
        return
      }
      blogger.info(`${this.traceId} ${trace2} descrease position price delta ok, price delta: ${priceDelta} greater than ${this.arbitrageConfig.DECREASE_PRICE_DELTA_BPS}`)
    }
    // 5. 计算减仓数量
    quantity = ParamsMgr.USD_AMOUNT_EVERY_ORDER.dividedBy(price)
    if (percent && percent > 0 && percent <= 0.2) {
      // 最多进行20%的减仓
      const quantity1 = BigNumber(positionAmtAbs).multipliedBy(percent)
      const quantity2 = BigNumber(this.arbitrageConfig.REBALANCE_MAX_USD_AMOUNT).dividedBy(price)
      // 取两者中的较小值
      const _quantity = quantity1.lt(quantity2) ? quantity1 : quantity2
      if (BigNumber(_quantity).gt(BigNumber(quantity))) {
        quantity = BigNumber(_quantity)
      }
      blogger.info(`${this.traceId} ${trace2}, decrease position use percent: ${percent}, quantity: ${quantity}, _quantity: ${_quantity}, quantity1: ${quantity1}, quantity2: ${quantity2}`)
    }
    if (BigNumber(quantity).eq(0)) {
      blogger.info(`${this.traceId} ${trace2}, decrease position quantity: ${quantity} equal zero, positionAmt: ${positionAmt}`)
      return
    }
    // 6. 如果减仓数量大于持仓数量的一半时，则减仓数量为持仓数量
    const minPositionAmt = BigNumber.min(BigNumber(btPosition.positionAmt).abs(), BigNumber(qtPosition.positionAmt).abs())
    if (BigNumber(quantity).multipliedBy(2).gt(minPositionAmt)) {
      blogger.info(`${this.traceId} ${trace2}, decrease position quantity: ${quantity} greater than 2 * positionAmt(${minPositionAmt}), btPosition: ${btPosition.positionAmt}, qtPosition: ${qtPosition.positionAmt}`)
      quantity = minPositionAmt
    }
    const validQuantity = calculateValidQuantity(quantity, tokenQty.minQty, tokenQty.stepSize, null)
    if (validQuantity <= 0) {
      blogger.info(`${this.traceId} ${trace2}, decrease position, validQuantity: ${validQuantity} is 0, not decrease position`)
      return
    }
    return {
      chainToken,
      baseExchange,
      quoteExchange,
      baseExchangeToken,
      quoteExchangeToken,
      side,
      quantity: validQuantity.toString()
    }
  }

  /**
   * 减仓
   * 1. 首先对资费亏损的仓位进行减仓
   * 2. 其次对资费盈利的仓位按total从小到大进行减仓
   * @param riskData 
   * @param fundingFeeData 
   */
  async decreasePosition(riskData: TRiskDataInfo, fundingFeeData: TCoinData[], percent?: number) {
    if (fundingFeeData.length === 0) {
      blogger.info(`${this.traceId} no funding fee data, no decrease position`)
      return
    }
    const promises = []
    // 1. 首先对资费亏损的仓位进行减仓
    const chainTokenPositionMap = riskData.chainTokenPositionMap
    for(const chainToken of chainTokenPositionMap.keys()) {
      const feeData = fundingFeeData.filter(feeData => feeData.chainToken === chainToken)
      const chainTokenPosition = chainTokenPositionMap.get(chainToken)
      if (feeData.length > 0 && chainTokenPosition) {
        for(const feeItem of feeData) {
          const side1 = UtilsMgr.getSideByTotalAPR(feeItem.total)
          const btPosition = chainTokenPosition.positions[feeItem.baseExchangeIndex]
          const qtPosition = chainTokenPosition.positions[feeItem.quoteExchangeIndex]
          const trace2 = `chainToken: ${chainToken}, btExchange: ${feeItem.baseExchange}, qtExchange: ${feeItem.quoteExchange}`
          if (!btPosition || !qtPosition) {
            continue
          }
          const side2 = UtilsMgr.getSideByPositionAmt(btPosition.positionAmt)
          if (side1 !== side2) {
            const orderParams = await this._decreasePosition(trace2, btPosition, qtPosition, feeItem, percent)
            if (orderParams) {
              promises.push(orderParams)
            }
          } else {
            blogger.info(`${this.traceId} ${trace2}, no need decrease position, total: ${feeItem.total}, side1: ${side1}, side2: ${side2}`)
          }
        }
      }
    }
    blogger.info(`${this.traceId} first fund loss promises: ${JSON.stringify(promises)}`)
    // 2. 其次对资费盈利的仓位按total从小到大进行减仓
    // 按照total从小到大排序
    if (promises.length === 0) {
      const feeDataAsc = fundingFeeData.sort((a, b) => {
        return BigNumber(a.total.abs()).minus(BigNumber(b.total.abs())).toNumber()
      })
      for(let i = 0; i < feeDataAsc.length; i++) {
        const feeData = feeDataAsc[i]
        const chainTokenPosition = chainTokenPositionMap.get(feeData.chainToken)
        if (!chainTokenPosition) {
          continue
        }
        const btPosition = chainTokenPosition.positions[feeData.baseExchangeIndex]
        const qtPosition = chainTokenPosition.positions[feeData.quoteExchangeIndex]
        const trace2 = `chainToken: ${feeData.chainToken}, btExchange: ${feeData.baseExchange}, qtExchange: ${feeData.quoteExchange}`
        if (!btPosition || !qtPosition) {
          blogger.info(`${this.traceId} ${trace2}, basePosition not found`)
          continue
        }
        const orderParams = await this._decreasePosition(trace2, btPosition, qtPosition, feeData, percent)
        if (orderParams) {
          promises.push(orderParams)
        }
        if (promises.length >= this.arbitrageConfig.MAX_REDUCE_POSITION_COUNTER) {
          break
        }
      }
      blogger.info(`${this.traceId} second fund profit promises: ${JSON.stringify(promises)}, feeDataAsc length: ${feeDataAsc.length}`)
    }
    // 没有需要减仓的仓位时报警
    if (promises.length === 0) {
      const msg = `${this.traceId} no valid order params, not decrease position`
      blogger.info(msg)
      if (percent) {
        NoticeMgr.sendNoDecreasePositiondMsg(this.traceId, msg)
      } else {
        // 通知时间拉长
        NoticeMgr.sendNoDecreasePositiondMsg2(this.traceId, msg)
      }
      return
    }
    const orderParams = await Promise.all(promises)
    // 过滤掉undefined
    const orderParamsValid = orderParams.filter(orderParam => orderParam !== undefined)
    if (orderParamsValid.length === 0) {
      blogger.info(`${this.traceId} no valid order params, not decrease position`)
      return
    }
    blogger.info(`${this.traceId} decrease position valid order params: ${JSON.stringify(orderParamsValid)}`)
    // 创建订单
    const orderTakerMgr = new OrderTakerMgr(this.traceId, EOrderReason.DECREASE_POSITION)
    const orderPromises = []
    for(const orderParam of orderParamsValid) {
      orderPromises.push(orderTakerMgr.createOrderTaker(orderParam.baseExchange, orderParam.baseExchangeToken, orderParam.quoteExchange, orderParam.quoteExchangeToken, orderParam.side, orderParam.quantity, true))
    }
    try {
      await Promise.all(orderPromises)
      await this.toTg(orderParamsValid)
    } catch(err: any) {
      const msg = `${this.traceId} decrease position error: ${JSON.stringify(err)}`
      blogger.error(msg)
      throw new Error(msg)
    }
  }
}
