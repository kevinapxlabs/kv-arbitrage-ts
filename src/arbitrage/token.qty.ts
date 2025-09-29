import BigNumber from "bignumber.js"
import { TTokenQty } from "../common/types/exchange.type.js"
import { ExchangeIndexMgr } from "./exchange.index.js"
import { TSMap } from "../libs/tsmap.js"
import { TExchangeTokenInfo, TokenInfoService } from "../service/tokenInfo.service.js"
import { blogger } from "../common/base/logger.js"

/*
* 获取所有交易所的token qty，选择最小下单数量和步长
*/
export class TokenQtyMgr {
  traceId: string
  exchangeIndexMgr: ExchangeIndexMgr

  constructor(traceId: string, exchangeIndexMgr: ExchangeIndexMgr) {
    this.traceId = traceId
    this.exchangeIndexMgr = exchangeIndexMgr
  }

  /*
  * 获取最小数量和步长
  * @param baseToken 基础货币
  * @returns 最小数量和步长
  */
  async getMinQtyDecimal(
    chainToken: string,
    exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  ): Promise<TTokenQty | undefined> {
    let maxMinQty: BigNumber | undefined
    let maxStepSize: BigNumber | undefined
    let validCount = 0
    await Promise.all(this.exchangeIndexMgr.exchangeList.map(async (exchange) => {
      const key = TokenInfoService.getExchangeTokenKey(exchange.exchangeName, chainToken)
      const exchangeInfo = exchangeTokenInfoMap.get(key)
      if (!exchangeInfo) {
        blogger.warn(`${this.traceId} chainToken: ${chainToken} getMinQtyDecimal not found in tokenInfoMap, key: ${key}`)
        return
      }
      const symbol = exchange.generateOrderbookSymbol(exchangeInfo.exchangeTokenInfo.exchangeToken)
      try {
        const tokenQty = await exchange.getQtyFilter(symbol)
        if (!tokenQty) {
          blogger.warn(`${this.traceId} chainToken: ${chainToken} tokenQty not found from exchange: ${exchange.exchangeName}, symbol: ${symbol}`)
          return
        }
        const minQty = new BigNumber(tokenQty.minQty)
        const stepSize = new BigNumber(tokenQty.stepSize)
        if (minQty.isNaN() || stepSize.isNaN()) {
          blogger.warn(`${this.traceId} chainToken: ${chainToken} tokenQty invalid number from exchange: ${exchange.exchangeName}, symbol: ${symbol}`)
          return
        }
        maxMinQty = maxMinQty ? BigNumber.max(maxMinQty, minQty) : minQty
        maxStepSize = maxStepSize ? BigNumber.max(maxStepSize, stepSize) : stepSize
        validCount += 1
      } catch (error) {
        blogger.warn(`${this.traceId} chainToken: ${chainToken} tokenQty fetch failed from exchange: ${exchange.exchangeName}, symbol: ${symbol}, error: ${error}`)
      }
    }))
    if (validCount < 2 || !maxMinQty || !maxStepSize) {
      return undefined
    }
    return {
      minQty: maxMinQty.toString(),
      stepSize: maxStepSize.toString()
    }
  }
}
