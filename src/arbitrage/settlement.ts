import BigNumber from "bignumber.js"
import { EKVSide, EOrderReason } from "../common/exchange.enum.js"
import { blogger } from "../common/base/logger.js"
import { rdsClient } from "../common/db/redis.js"
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
import { RedisKeyMgr } from "../common/redis.key.js"
import { TSMap } from "../libs/tsmap.js"

export class SettlementMgr extends ArbitrageBase {
  arbitrageConfig: TArbitrageConfig
  takerNumberOneTime = 3        // 每次最多下3个taker单
  exchangeIndexMgr: ExchangeIndexMgr
  exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  orderTakerMgr: OrderTakerMgr
  private readonly maxHoldingMs = 24 * 60 * 60 * 1000

  constructor(traceId: string, exchangeIndexMgr: ExchangeIndexMgr, arbitrageConfig: TArbitrageConfig, exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>) {
    super(`${traceId} profit locked`)
    this.exchangeIndexMgr = exchangeIndexMgr
    this.arbitrageConfig = arbitrageConfig
    this.exchangeTokenInfoMap = exchangeTokenInfoMap
    this.orderTakerMgr = new OrderTakerMgr(this.traceId, EOrderReason.PROFIT_LOCKED)
  }

  private composePositionKey(chainToken: string, baseExchange: string, quoteExchange: string): string {
    return `${chainToken}|${baseExchange}|${quoteExchange}`
  }

  /* 获取持仓时间
  * 若redis无数据则视为持仓时间过长，返回0；否则返回redis记录的持仓时长
  * @param chainToken 币种
  * @param baseExchange 基础交易所
  * @param quoteExchange 报价交易所
  * @returns 持仓时间 最新开仓时间 秒级时间戳
  */
  private async getPositionOpenedAt(chainToken: string, baseExchange: ExchangeAdapter, quoteExchange: ExchangeAdapter): Promise<number> {
    const redisKey = RedisKeyMgr.positionOpenTimestampKey(chainToken, baseExchange.exchangeName, quoteExchange.exchangeName)
    try {
      const value = await rdsClient.get(redisKey)
      if (!value) {
        return 0
      }
      let openedAt = Number(value)
      if (!Number.isFinite(openedAt) || openedAt <= 0) {
        blogger.warn(`${this.traceId} invalid position open timestamp, redisKey: ${redisKey}, value: ${value}`)
        return 0
      }
      if (openedAt < 1e12) {
        openedAt = openedAt
      }
      return openedAt
    } catch (error) {
      blogger.error(`${this.traceId} getPositionOpenedAt error, redisKey: ${redisKey}, error: ${error instanceof Error ? error.message : error}`)
      return 0
    }
  }

  // 若redis无数据则视为持仓时间过长，返回0；否则返回redis记录的持仓时长
  private async getHoldDurationMs(chainToken: string, baseExchange: ExchangeAdapter, quoteExchange: ExchangeAdapter): Promise<number> {
    const now = Date.now()
    const openedAt = await this.getPositionOpenedAt(chainToken, baseExchange, quoteExchange)
    if (openedAt > now) {
      return 0
    }
    return now - openedAt
  }

  private buildFundingFeeMap(fundingFeeData: TCoinData[]): Map<string, TCoinData> {
    const fundingFeeMap = new Map<string, TCoinData>()
    for (const item of fundingFeeData) {
      const forwardKey = this.composePositionKey(item.chainToken, item.baseExchange, item.quoteExchange)
      fundingFeeMap.set(forwardKey, item)
    }
    return fundingFeeMap
  }

  // 根据持仓时长和资费差动态计算当前需要满足的利差阈值
  private computeRequiredSpreadBps(holdDurationMs: number, fundingDiffBps: number | undefined): number {
    const minBps = this.arbitrageConfig.SETTLEMENT_PRICE_VAR_BPS_MIN
    const maxBps = this.arbitrageConfig.SETTLEMENT_PRICE_VAR_BPS_MAX
    if (maxBps <= minBps) {
      return minBps
    }
    const range = maxBps - minBps
    let startingThreshold = maxBps
    if (fundingDiffBps !== undefined && Number.isFinite(fundingDiffBps)) {
      const cappedFunding = Math.max(-range, Math.min(range, fundingDiffBps))
      startingThreshold = Math.max(minBps, Math.min(maxBps, maxBps + cappedFunding))
    }
    const holdRatio = Math.max(0, Math.min(holdDurationMs / this.maxHoldingMs, 1))
    const threshold = minBps + (startingThreshold - minBps) * (1 - holdRatio)
    return Math.max(minBps, Math.min(maxBps, threshold))
  }

  // 检查是否达到 profit 最小要求
  async hasProfitCheck(
    chainToken: string,
    btExchange: ExchangeAdapter,
    btPosition: TKVPosition,
    qtExchange: ExchangeAdapter,
    qtPosition: TKVPosition,
    fundingData: TCoinData | undefined,
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
    const holdDurationMs = await this.getHoldDurationMs(chainToken, btExchange, qtExchange)   // 记录该组合的持仓时长，用于动态阈值
    const holdHours = holdDurationMs / (60 * 60 * 1000)
    const fundingDiffBps = fundingData ? fundingData.total.toNumber() : undefined
    const requiredDelta = this.computeRequiredSpreadBps(holdDurationMs, fundingDiffBps)
    if (priceDelta < requiredDelta) {
      blogger.info(`${this.traceId} ${trace2}, symbol: ${btSymbol}, price delta: ${priceDelta} below required ${requiredDelta}, holdHours: ${holdHours.toFixed(2)}, fundingDiffBps: ${fundingDiffBps}`)
      return
    }
    const price = await exchangeDataMgr.getIndexPrice2([btExchange, qtExchange], chainToken, this.exchangeTokenInfoMap)
    if (!price) {
      blogger.info(`${this.traceId} ${trace2}, price not found, exchange: ${btExchange.exchangeName}`)
      return
    }
    if (holdDurationMs >= this.maxHoldingMs) {
      blogger.warn(`${this.traceId} ${trace2}, holding time ${holdHours.toFixed(2)}h exceeded limit, using min delta ${this.arbitrageConfig.SETTLEMENT_PRICE_VAR_BPS_MIN}`)
    }
    blogger.info(`${this.traceId} ${trace2}, price delta ok, symbol: ${btSymbol}, price delta: ${priceDelta}, required delta: ${requiredDelta}, holdHours: ${holdHours.toFixed(2)}, fundingDiffBps: ${fundingDiffBps}, btPosition: ${JSON.stringify(btPosition)}, qtPosition: ${JSON.stringify(qtPosition)}`)
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
      const fundingFeeMap = this.buildFundingFeeMap(fundingFeeData)  // 便于快速定位两交易所之间的资费差
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
            const positionKey = this.composePositionKey(baseToken, btExchange.exchangeName, qtExchange.exchangeName)
            const fundingData = fundingFeeMap.get(positionKey)
            orderPromises.push(this.hasProfitCheck(baseToken, btExchange, btPosition, qtExchange, qtPosition, fundingData))
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
