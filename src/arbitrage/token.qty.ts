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
    let minQtyList: BigNumber[] = [], stepSizeList: BigNumber[] = []
    for (const exchange of this.exchangeIndexMgr.exchangeList) {
      const key = TokenInfoService.getExchangeTokenKey(exchange.exchangeName, chainToken)
      const exchangeInfo = exchangeTokenInfoMap.get(key)
      if (!exchangeInfo) {
        blogger.warn(`${this.traceId} chainToken: ${chainToken} getMinQtyDecimal not found in tokenInfoMap, key: ${key}`)
        return undefined
      }
      const symbol = exchange.generateOrderbookSymbol(exchangeInfo.exchangeTokenInfo.exchangeToken)
      const tokenQty = await exchange.getQtyFilter(symbol)
      if (tokenQty) {
        minQtyList.push(BigNumber(tokenQty.minQty))
        stepSizeList.push(BigNumber(tokenQty.qtyStep))
      } else {
        blogger.warn(`${this.traceId} chainToken: ${chainToken} tokenQty not found from exchange: ${exchange.exchangeName}, symbol: ${symbol}`)
      }
    }
    if (minQtyList.length < 2 || stepSizeList.length < 2) {
      return undefined
    }
    return { 
      minQty: BigNumber.max(...minQtyList).toString(),
      stepSize: BigNumber.max(...stepSizeList).toString()
    }
  }
}
