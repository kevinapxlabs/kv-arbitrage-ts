import BigNumber from "bignumber.js"
import { EKVSide, EOrderReason } from "../common/exchange.enum.js"
import { blogger } from "../common/base/logger.js"
import { TCoinData, TOrderParams } from "../common/types/exchange.type.js"
import { TKVPosition } from "../exchanges/types.js"
import { sendMsg } from "../utils/bot.js"
import { ParamsMgr } from "./params.js"
import { TRiskDataInfo } from "./type.js"
import { ArbitrageBase } from "./base.js"
import { UtilsMgr } from "./utils.js"
import { TokenQtyMgr } from "./token.qty.js"
import { ExchangeAdapter } from "../exchanges/exchange.adapter.js"
import { OrderTakerMgr } from "./order.taker.js"
import { ExchangeIndexMgr } from "./exchange.index.js"
import { calculateValidQuantity } from "../utils/utils.js"
import { ExchangeDataMgr } from "./exchange.data.js"
import { TArbitrageConfig } from "./arbitrage.config.js"
import { TExchangeTokenInfo, TokenInfoService } from "../service/tokenInfo.service.js"
import { TSMap } from "../libs/tsmap.js"

export class SettlementMgr extends ArbitrageBase {
  arbitrageConfig: TArbitrageConfig
  takerNumberOneTime = 3        // 每次最多下3个taker单
  exchangeIndexMgr: ExchangeIndexMgr
  exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  orderTakerMgr: OrderTakerMgr

  constructor(traceId: string, exchangeIndexMgr: ExchangeIndexMgr, arbitrageConfig: TArbitrageConfig, exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>) {
    super(`${traceId} profit locked`)
    this.exchangeIndexMgr = exchangeIndexMgr
    this.arbitrageConfig = arbitrageConfig
    this.exchangeTokenInfoMap = exchangeTokenInfoMap
    this.orderTakerMgr = new OrderTakerMgr(this.traceId, EOrderReason.PROFIT_LOCKED)
  }

  // 检查是否达到 profit 最小要求
  async hasProfitCheck(
    chainToken: string,
    btExchange: ExchangeAdapter,
    btPosition: TKVPosition,
    qtExchange: ExchangeAdapter,
    qtPosition: TKVPosition
  ): Promise<TOrderParams | undefined> {
    const trace2 = `chainToken: ${chainToken}, btEx: ${btExchange.exchangeName}, qtEx: ${qtExchange.exchangeName}`
    // 1. 检查两边持仓方向是否相反
    const btSide = UtilsMgr.getSideByPositionAmt(btPosition.positionAmt)
    const qtSide = UtilsMgr.getSideByPositionAmt(qtPosition.positionAmt)
    if (btSide === qtSide) {
      blogger.info(`${this.traceId} ${trace2}, btSide: ${btSide} qtSide: ${qtSide} not profit locked, same side`)
      return
    }
    // 2. 获取baseExchangeToken
    const baseKey = TokenInfoService.getExchangeTokenKey(btExchange.exchangeName, chainToken)
    const baseExchangeTokenInfo = this.exchangeTokenInfoMap.get(baseKey)
    if (!baseExchangeTokenInfo) {
      blogger.info(`${this.traceId} ${trace2}, chainToken: ${chainToken}, baseExchange: ${btExchange.exchangeName} not found in exchangeTokenInfoMap`)
      return
    }
    const baseExchangeToken = baseExchangeTokenInfo.exchangeTokenInfo.exchangeToken
    // 3. 获取quoteExchangeToken
    const quoteKey = TokenInfoService.getExchangeTokenKey(qtExchange.exchangeName, chainToken)
    const quoteExchangeTokenInfo = this.exchangeTokenInfoMap.get(quoteKey)
    if (!quoteExchangeTokenInfo) {
      blogger.info(`${this.traceId} ${trace2}, chainToken: ${chainToken}, quoteExchange: ${qtExchange.exchangeName} not found in exchangeTokenInfoMap`)
      return
    }
    const quoteExchangeToken = quoteExchangeTokenInfo.exchangeTokenInfo.exchangeToken
    // 4. 获取bp和bn的 qtyDecimal, 并取最小值
    const tokenQtyMgr = new TokenQtyMgr(this.traceId, this.exchangeIndexMgr)
    const tokenQty = await tokenQtyMgr.getMinQtyDecimal(chainToken, this.exchangeTokenInfoMap)
    if (!tokenQty) {
      blogger.info(`${this.traceId} ${trace2}, no token qty, exchange: ${btExchange}`)
      return
    }
    // 5. 根据backpack与binance的orderbook，计算是否达到price decimal
    // 5.1 获取orderbook
    const btSymbol = btExchange.generateOrderbookSymbol(baseExchangeToken)
    const exchangeDataMgr = new ExchangeDataMgr(this.traceId)
    const btOrderbook = await exchangeDataMgr.getOrderBook(btExchange.exchangeName, btSymbol)
    if (!btOrderbook) {
      blogger.info(`${this.traceId} ${trace2}, orderbook ${btSymbol} not found, exchange: ${btExchange.exchangeName}`)
      return
    }
    if (btOrderbook.bids.length === 0 || btOrderbook.asks.length === 0) {
      blogger.info(`${this.traceId} ${trace2}, orderbook ${btSymbol} is empty, exchange: ${btExchange.exchangeName}`)
      return
    }
    const side = btSide === EKVSide.LONG ? EKVSide.SHORT : EKVSide.LONG
    // 6. 根据baseExchange的side计算两交易所baseToken的price decimal
    let priceDelta = await this.getPriceDelta(trace2, side, baseExchangeToken, btExchange, quoteExchangeToken, qtExchange)
    if (!priceDelta) {
      blogger.info(`${this.traceId}, ${trace2}, priceDelta not found, exchange: ${btExchange.exchangeName}`)
      return
    }
    if (priceDelta < this.arbitrageConfig.SETTLEMENT_PRICE_VAR_BPS_MAX) {
      blogger.info(`${this.traceId} ${trace2}, symbol: ${btSymbol}, price delta: ${priceDelta} less than ${this.arbitrageConfig.SETTLEMENT_PRICE_VAR_BPS_MAX}, not increase position`)
      return
    }
    const price = await exchangeDataMgr.getIndexPrice2([btExchange, qtExchange], chainToken, this.exchangeTokenInfoMap)
    if (!price) {
      blogger.info(`${this.traceId} ${trace2}, price not found, exchange: ${btExchange.exchangeName}`)
      return
    }
    blogger.info(`${this.traceId} ${trace2}, price delta is ok, symbol: ${btSymbol}, price delta: ${priceDelta}, price var ${this.arbitrageConfig.SETTLEMENT_PRICE_VAR_BPS_MAX}, btPosition: ${JSON.stringify(btPosition)}, qtPosition: ${JSON.stringify(qtPosition)}`)
    const quantity = ParamsMgr.USD_AMOUNT_EVERY_ORDER.dividedBy(price)
    let newQuantity = quantity
    // 7. 如果btPosition 或 qtPosition 的positionAmt 小于 quantity * 2，则使用 positionAmt 作为新的quantity
    const minPositionAmt = BigNumber.min(BigNumber(btPosition.positionAmt).abs(), BigNumber(qtPosition.positionAmt).abs())
    if (quantity.multipliedBy(2).gt(minPositionAmt)) {
      blogger.info(`${this.traceId} ${trace2}, quantity: ${quantity} greater than 2 * positionAmt(${minPositionAmt}), btPosition: ${btPosition.positionAmt}, qtPosition: ${qtPosition.positionAmt}`)
      newQuantity = minPositionAmt
    }
    const validQuantity = calculateValidQuantity(newQuantity, tokenQty.minQty, tokenQty.stepSize, null)
    if (validQuantity <= 0) {
      blogger.info(`${this.traceId} ${trace2}, validQuantity: ${validQuantity} is 0, not profit locked`)
      return
    }
    // 8. 下单
    // 8.1 检查是否达到最大持仓代币种类数量限制
    if (this.takerNumberOneTime <= 0) {
      blogger.info(`${this.traceId}, ${trace2} no increase position, takerNumberOneTime: ${this.takerNumberOneTime} less than 0`)
      return
    }
    // 8.2 减去1
    this.takerNumberOneTime--
    // 8.3 下单
    await this.orderTakerMgr.createOrderTaker(btExchange, baseExchangeToken, qtExchange, quoteExchangeToken, side, validQuantity.toString(), true)
    return {
      chainToken,
      baseExchange: btExchange,
      quoteExchange: qtExchange,
      baseExchangeToken,
      quoteExchangeToken,
      side,
      quantity: validQuantity.toString()
    }
  }

  // 打印日志
  async toLog(orderParams: TOrderParams[]) {
    const texts = []
    for(let i = 0; i < orderParams.length; i++) {
      const item = orderParams[i]
      const msg = `chainToken: ${item.chainToken}, quantity: ${item.quantity}, side: ${item.side}(${item.baseExchange.exchangeName}(${item.baseExchangeToken})|${item.quoteExchange.exchangeName}(${item.quoteExchangeToken}))`
      texts.push(msg)
    }
    blogger.info(`${this.traceId} hasProfitCheck promises: ${texts.join('><')}`)
  }

  async toTg(orderParams: TOrderParams[]) {
    const texts = ['【通知主题】: 资产结算(利润结算)']
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
    // console.log(content)
    await sendMsg(ParamsMgr.TG_NOTICE_NAME, content)
  }
  
  async run(riskData: TRiskDataInfo, fundingFeeData: TCoinData[]) {
    const tokenKeys = riskData.chainTokenPositionMap.keys()
    // 1. 检查是否达到 profit 最小要求
    if (tokenKeys.length > 0) {
      const orderPromises = []
      for(const baseToken of tokenKeys) {
        const baseTokenPosition = riskData.chainTokenPositionMap.get(baseToken)
        if (!baseTokenPosition) {
          continue
        }
        for (const indexList of this.exchangeIndexMgr.exchangeIndexList) {
          const positions = baseTokenPosition.positions
          const btPosition = positions[indexList[0]]
          const qtPosition = positions[indexList[1]]
          if (btPosition && qtPosition) {
            const btExchange = this.exchangeIndexMgr.exchangeList[indexList[0]]
            const qtExchange = this.exchangeIndexMgr.exchangeList[indexList[1]]
            orderPromises.push(this.hasProfitCheck(baseToken, btExchange, btPosition, qtExchange, qtPosition))
          }
        }
      }
      const orderParams = await Promise.all(orderPromises)
      const orderValidParams = orderParams.filter(item => item !== undefined)
      // 1.1 打印日志
      this.toLog(orderValidParams)
      if (orderValidParams.length > 0) {
        // 2. 发送通知
        await this.toTg(orderValidParams)
      }
    }
  }
}