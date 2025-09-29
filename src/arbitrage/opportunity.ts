import BigNumber from "bignumber.js"
import { blogger } from "../common/base/logger.js"
import { EKVSide, EOrderReason } from "../common/exchange.enum.js"
import { TOrderParams, TTokenQty } from "../common/types/exchange.type.js"
import { ExchangeAdapter } from "../exchanges/exchange.adapter.js"
import { TKVPosition } from "../exchanges/types.js"
import { TSMap } from "../libs/tsmap.js"
import { sendMsg } from "../utils/bot.js"
import { calculateValidQuantity } from "../utils/utils.js"
import { ArbitrageBase } from "./base.js"
import { ExchangeDataMgr } from "./exchange.data.js"
import { ExchangeIndexMgr } from "./exchange.index.js"
import { OrderTakerMgr } from "./order.taker.js"
import { ParamsMgr } from "./params.js"
import { TokenQtyMgr } from "./token.qty.js"
import { TArbitrageConfig } from "./arbitrage.config.js"
import { TRiskDataInfo } from "./type.js"
import { TExchangeTokenInfo, TTokenInfo, TokenInfoService } from "../service/tokenInfo.service.js"

export class OpportunityMgr extends ArbitrageBase {
  exchangeIndexMgr: ExchangeIndexMgr
  arbitrageConfig: TArbitrageConfig
  tokenInfoMap: TSMap<string, TTokenInfo>
  exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>

  constructor(
    traceId: string,
    exchangeIndexMgr: ExchangeIndexMgr,
    arbitrageConfig: TArbitrageConfig,
    tokenInfoMap: TSMap<string, TTokenInfo>,
    exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  ) {
    super(`${traceId} opportunity`)
    this.exchangeIndexMgr = exchangeIndexMgr
    this.arbitrageConfig = arbitrageConfig
    this.tokenInfoMap = tokenInfoMap
    this.exchangeTokenInfoMap = exchangeTokenInfoMap
  }

  // 检查是否在禁止或稳定币列表
  private isTokenForbidden(chainToken: string): boolean {
    const upperToken = chainToken.toUpperCase()
    if (this.arbitrageConfig.TOKEN_BANNED_LIST.includes(upperToken)) {
      return true
    }
    return ParamsMgr.Stable_TOKEN_LIST.includes(upperToken)
  }

  private hasPosition(position: TKVPosition | null | undefined): boolean {
    if (!position) {
      return false
    }
    try {
      return BigNumber(position.positionAmt ?? 0).abs().gt(0)
    } catch {
      return false
    }
  }

  private getExchangeTokenSymbol(exchange: ExchangeAdapter, chainToken: string): string | undefined {
    const key = TokenInfoService.getExchangeTokenKey(exchange.exchangeName, chainToken)
    const exchangeInfo = this.exchangeTokenInfoMap.get(key)
    return exchangeInfo?.exchangeTokenInfo.exchangeToken
  }

  // 计算满足步长约束的下单数量
  private calculateOrderQuantity(price: BigNumber, tokenQty: TTokenQty): string | undefined {
    if (price.lte(0)) {
      return undefined
    }
    const desiredQuantity = ParamsMgr.USD_AMOUNT_EVERY_ORDER.dividedBy(price)
    if (desiredQuantity.lte(0)) {
      return undefined
    }
    const validQuantityNumber = calculateValidQuantity(desiredQuantity, tokenQty.minQty, tokenQty.stepSize, null)
    if (validQuantityNumber <= 0) {
      return undefined
    }
    return BigNumber(validQuantityNumber).toFixed()
  }

  // 判断新增仓位是否触发单所持仓品种上限
  private wouldExceedTokenLimit(
    exchangeIndex: number,
    chainToken: string,
    hasExistingPosition: boolean,
    plannedNewTokens: Map<number, Set<string>>,
    riskData: TRiskDataInfo
  ): boolean {
    if (hasExistingPosition) {
      return false
    }
    let plannedSet = plannedNewTokens.get(exchangeIndex)
    const alreadyPlanned = plannedSet?.has(chainToken) ?? false
    if (alreadyPlanned) {
      return false
    }
    const exchange = this.exchangeIndexMgr.exchangeList[exchangeIndex]
    const riskInfo = riskData.exchangeRiskInfo.get(exchange.exchangeName)
    const existingCount = riskInfo?.positionCounter ?? 0
    const plannedCount = plannedSet?.size ?? 0
    return existingCount + plannedCount >= this.arbitrageConfig.MAX_POSITION_TOKEN_COUNTER
  }

  // 记录在本轮内新增的币种仓位
  private markTokenOpened(
    exchangeIndex: number,
    chainToken: string,
    hasExistingPosition: boolean,
    plannedNewTokens: Map<number, Set<string>>
  ) {
    if (hasExistingPosition) {
      return
    }
    let plannedSet = plannedNewTokens.get(exchangeIndex)
    if (!plannedSet) {
      plannedSet = new Set<string>()
      plannedNewTokens.set(exchangeIndex, plannedSet)
    }
    plannedSet.add(chainToken)
  }

  private logOrders(orderParams: TOrderParams[]) {
    const logs = orderParams.map((item) => {
      return `${item.chainToken}|${item.quantity}|${item.side}|${item.baseExchange.exchangeName}(${item.baseExchangeToken})/${item.quoteExchange.exchangeName}(${item.quoteExchangeToken})`
    })
    blogger.info(`${this.traceId} opportunity orders: ${logs.join(' >< ')}`)
  }

  private async notifyOrders(orderParams: TOrderParams[]) {
    const texts = ['【通知主题】: 套利建仓']
    for (const item of orderParams) {
      const sideText = item.side === EKVSide.LONG ? 'BUY' : 'SELL'
      texts.push(`【${item.chainToken}】: ${item.quantity}`)
      texts.push(`【Side】: ${sideText}(${item.baseExchange.exchangeName}|${item.quoteExchange.exchangeName})`)
    }
    texts.push(`【Mark】: ${this.traceId}`)
    const content = texts.join('\n')
    await sendMsg(ParamsMgr.TG_NOTICE_NAME, content)
  }

  async run(riskData: TRiskDataInfo) {
    if (this.arbitrageConfig.REDUCE_ONLY) {
      blogger.info(`${this.traceId} reduce only enabled, skip opportunity detection`)
      return
    }

    const exchangeList = this.exchangeIndexMgr.exchangeList
    if (exchangeList.length < 2) {
      blogger.info(`${this.traceId} exchange list length less than 2, skip opportunity detection`)
      return
    }

    let remainingOrders = this.arbitrageConfig.MAX_POSITION_COUNTER
    if (remainingOrders <= 0) {
      blogger.info(`${this.traceId} max position counter is 0, skip opportunity detection`)
      return
    }

    const tokenQtyMgr = new TokenQtyMgr(this.traceId, this.exchangeIndexMgr)
    const orderTakerMgr = new OrderTakerMgr(this.traceId, EOrderReason.DEFAULT)
    const exchangeDataMgr = new ExchangeDataMgr(this.traceId)
    const plannedNewTokens = new Map<number, Set<string>>()
    const executedOrders: TOrderParams[] = []
    const maxTokenNotional = BigNumber(this.arbitrageConfig.MAX_USD_EXCHANGE_AMOUNT_TOKEN)
    for (const chainToken of this.tokenInfoMap.keys()) {
      if (remainingOrders <= 0) {
        break
      }
      if (this.isTokenForbidden(chainToken)) {
        continue
      }

      const tokenPosition = riskData.chainTokenPositionMap.get(chainToken)
      const exchangeNotional = new Map<number, BigNumber>()
      for (let i = 0; i < exchangeList.length; i++) {
        const position = tokenPosition?.positions?.[i] ?? null
        const notional = BigNumber(position?.notional ?? 0)
        exchangeNotional.set(i, notional)
      }

      const tokenQty = await tokenQtyMgr.getMinQtyDecimal(chainToken, this.exchangeTokenInfoMap)
      if (!tokenQty) {
        blogger.info(`${this.traceId} chainToken ${chainToken} missing quantity filter, skip`)
        continue
      }

      for (const [baseIndex, quoteIndex] of this.exchangeIndexMgr.exchangeIndexList) {
        if (remainingOrders <= 0) {
          break
        }
        const baseExchange = exchangeList[baseIndex]
        const quoteExchange = exchangeList[quoteIndex]
        const baseToken = this.getExchangeTokenSymbol(baseExchange, chainToken)
        const quoteToken = this.getExchangeTokenSymbol(quoteExchange, chainToken)
        if (!baseToken || !quoteToken) {
          continue
        }

        const basePosition = tokenPosition?.positions?.[baseIndex] ?? null
        const quotePosition = tokenPosition?.positions?.[quoteIndex] ?? null
        const baseHasPosition = this.hasPosition(basePosition)
        const quoteHasPosition = this.hasPosition(quotePosition)

        const baseNotional = exchangeNotional.get(baseIndex) ?? BigNumber(0)
        const quoteNotional = exchangeNotional.get(quoteIndex) ?? BigNumber(0)
        if (baseNotional.gte(maxTokenNotional) || quoteNotional.gte(maxTokenNotional)) {
          continue
        }

        if (this.wouldExceedTokenLimit(baseIndex, chainToken, baseHasPosition, plannedNewTokens, riskData)) {
          continue
        }
        if (this.wouldExceedTokenLimit(quoteIndex, chainToken, quoteHasPosition, plannedNewTokens, riskData)) {
          continue
        }

        const trace2 = `chainToken: ${chainToken}, base: ${baseExchange.exchangeName}(${baseToken}), quote: ${quoteExchange.exchangeName}(${quoteToken})`
        const priceDelta = await this.getPriceDelta(trace2, EKVSide.LONG, baseToken, baseExchange, quoteToken, quoteExchange)
        if (priceDelta === undefined) {
          continue
        }

        let executeSide: EKVSide | undefined
        if (priceDelta > this.arbitrageConfig.PRICE_DELTA_BPS) {
          executeSide = EKVSide.LONG
        } else if (priceDelta < 0 && Math.abs(priceDelta) > this.arbitrageConfig.PRICE_DELTA_BPS) {
          executeSide = EKVSide.SHORT
        }

        if (!executeSide) {
          continue
        }

        const indexPrice = await exchangeDataMgr.getIndexPrice2([baseExchange, quoteExchange], chainToken, this.exchangeTokenInfoMap)
        if (!indexPrice) {
          blogger.info(`${this.traceId} ${trace2}, index price not found`)
          continue
        }

        const quantity = this.calculateOrderQuantity(indexPrice, tokenQty)
        if (!quantity) {
          blogger.info(`${this.traceId} ${trace2}, valid quantity not found`)
          continue
        }

        blogger.info(`${this.traceId} ${trace2}, priceDelta: ${priceDelta}, quantity: ${quantity}, side: ${executeSide}`)

        await orderTakerMgr.createOrderTaker(baseExchange, baseToken, quoteExchange, quoteToken, executeSide, quantity, false)
        executedOrders.push({
          chainToken,
          baseExchange,
          baseExchangeToken: baseToken,
          quoteExchange,
          quoteExchangeToken: quoteToken,
          quantity,
          side: executeSide
        })
        remainingOrders--

        this.markTokenOpened(baseIndex, chainToken, baseHasPosition, plannedNewTokens)
        this.markTokenOpened(quoteIndex, chainToken, quoteHasPosition, plannedNewTokens)
      }
    }

    if (executedOrders.length > 0) {
      this.logOrders(executedOrders)
      await this.notifyOrders(executedOrders)
    }
  }
}
