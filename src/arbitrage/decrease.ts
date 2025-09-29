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
  private readonly exchangeDataMgr: ExchangeDataMgr
  private readonly tokenQtyMgr: TokenQtyMgr

  constructor(traceId: string, exchangeIndexMgr: ExchangeIndexMgr, arbitrageConfig: TArbitrageConfig, exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>) {
    super(traceId)
    this.exchangeIndexMgr = exchangeIndexMgr
    this.arbitrageConfig = arbitrageConfig
    this.exchangeTokenInfoMap = exchangeTokenInfoMap
    this.exchangeDataMgr = new ExchangeDataMgr(traceId)
    this.tokenQtyMgr = new TokenQtyMgr(traceId, this.exchangeIndexMgr)
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
    const {
      chainToken,
      baseExchangeIndex,
      quoteExchangeIndex,
      baseExchangeToken,
      quoteExchangeToken,
      baseExchange
    } = feeData

    const basePositionAmt = BigNumber(btPosition.positionAmt)
    const quotePositionAmt = BigNumber(qtPosition.positionAmt)
    if (basePositionAmt.multipliedBy(quotePositionAmt).gte(0)) {
      blogger.info(`${this.traceId} ${trace2}, btPosition: ${btPosition.positionAmt}, qtPosition: ${qtPosition.positionAmt}, position is the same, not decrease position`)
      return
    }

    const positionAmtAbs = basePositionAmt.abs()
    const currentSide = UtilsMgr.getSideByPositionAmt(btPosition.positionAmt)
    const side = currentSide === EKVSide.LONG ? EKVSide.SHORT : EKVSide.LONG

    const baseAdapter = this.exchangeIndexMgr.exchangeList[baseExchangeIndex]
    const quoteAdapter = this.exchangeIndexMgr.exchangeList[quoteExchangeIndex]
    const baseSymbol = baseAdapter.generateOrderbookSymbol(baseExchangeToken)
    const orderbook = await this.exchangeDataMgr.getOrderBook(baseAdapter.exchangeName, baseSymbol)
    if (!orderbook) {
      blogger.info(`${this.traceId} ${trace2}, orderbook ${baseSymbol} not found, exchange: ${baseExchange}`)
      return
    }

    const priceLevels = side === EKVSide.LONG ? orderbook.bids : orderbook.asks
    if (!priceLevels?.length || priceLevels[0].length === 0) {
      blogger.info(`${this.traceId} ${trace2}, orderbook ${baseSymbol} missing ${side === EKVSide.LONG ? 'bids' : 'asks'}, exchange: ${baseExchange}`)
      return
    }

    const price = BigNumber(priceLevels[0][0])
    if (!price.isFinite() || price.lte(0)) {
      blogger.info(`${this.traceId} ${trace2}, invalid price ${priceLevels[0][0]} from ${baseSymbol}, exchange: ${baseExchange}`)
      return
    }

    const tokenQty = await this.tokenQtyMgr.getMinQtyDecimal(chainToken, this.exchangeTokenInfoMap)
    if (!tokenQty) {
      blogger.info(`${this.traceId} ${trace2}, no token qty, not decrease position`)
      return
    }

    if (percent === undefined) {
      const priceDelta = await this.getPriceDelta(trace2, side, baseExchangeToken, baseAdapter, quoteExchangeToken, quoteAdapter)
      if (priceDelta === undefined) {
        blogger.error(`${this.traceId} ${trace2}, decrease position failed, no price decimal`)
        return
      }
      if (priceDelta < this.arbitrageConfig.DECREASE_PRICE_DELTA_BPS) {
        blogger.info(`${this.traceId} ${trace2}, decrease position failed, price delta: ${priceDelta} less than ${this.arbitrageConfig.DECREASE_PRICE_DELTA_BPS}`)
        return
      }
      blogger.info(`${this.traceId} ${trace2} descrease position price delta ok, price delta: ${priceDelta} greater than ${this.arbitrageConfig.DECREASE_PRICE_DELTA_BPS}`)
    }

    let quantity = ParamsMgr.USD_AMOUNT_EVERY_ORDER.dividedBy(price)
    if (percent !== undefined && percent > 0 && percent <= 0.2) {
      const quantityByPercent = positionAmtAbs.multipliedBy(percent)
      const quantityByCap = BigNumber(this.arbitrageConfig.REBALANCE_MAX_USD_AMOUNT).dividedBy(price)
      const preferredQuantity = BigNumber.min(quantityByPercent, quantityByCap)
      if (preferredQuantity.gt(quantity)) {
        quantity = preferredQuantity
      }
      blogger.info(`${this.traceId} ${trace2}, decrease position use percent: ${percent}, quantity: ${quantity}, quantityByPercent: ${quantityByPercent}, quantityByCap: ${quantityByCap}`)
    }

    if (!quantity.isFinite() || quantity.lte(0)) {
      blogger.info(`${this.traceId} ${trace2}, decrease position quantity: ${quantity} less or equal zero, btPosition: ${btPosition.positionAmt}`)
      return
    }

    const minPositionAmt = BigNumber.min(positionAmtAbs, quotePositionAmt.abs())
    if (quantity.multipliedBy(2).gt(minPositionAmt)) {
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
      baseExchange: baseAdapter,
      quoteExchange: quoteAdapter,
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
    const ordersToCreate: TOrderParams[] = []
    // 预先聚合资费数据，避免重复过滤
    const fundingFeeByChainToken = new Map<string, TCoinData[]>()
    for (const feeItem of fundingFeeData) {
      if (!fundingFeeByChainToken.has(feeItem.chainToken)) {
        fundingFeeByChainToken.set(feeItem.chainToken, [])
      }
      fundingFeeByChainToken.get(feeItem.chainToken)!.push(feeItem)
    }
    // 1. 首先对资费亏损的仓位进行减仓
    const chainTokenPositionMap = riskData.chainTokenPositionMap
    for (const chainToken of chainTokenPositionMap.keys()) {
      const feeData = fundingFeeByChainToken.get(chainToken)
      const chainTokenPosition = chainTokenPositionMap.get(chainToken)
      if (feeData?.length && chainTokenPosition) {
        for (const feeItem of feeData) {
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
              ordersToCreate.push(orderParams)
            }
          } else {
            blogger.info(`${this.traceId} ${trace2}, no need decrease position, total: ${feeItem.total}, side1: ${side1}, side2: ${side2}`)
          }
        }
      }
    }
    blogger.info(`${this.traceId} first fund loss promises: ${JSON.stringify(ordersToCreate)}`)
    // 2. 其次对资费盈利的仓位按total从小到大进行减仓
    // 按照total从小到大排序
    if (ordersToCreate.length === 0) {
      const feeDataAsc = [...fundingFeeData].sort((a, b) => {
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
          ordersToCreate.push(orderParams)
        }
        if (ordersToCreate.length >= this.arbitrageConfig.MAX_REDUCE_POSITION_COUNTER) {
          break
        }
      }
      blogger.info(`${this.traceId} second fund profit promises: ${JSON.stringify(ordersToCreate)}, feeDataAsc length: ${feeDataAsc.length}`)
    }
    // 没有需要减仓的仓位时报警
    if (ordersToCreate.length === 0) {
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
    const orderParamsValid = ordersToCreate
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
