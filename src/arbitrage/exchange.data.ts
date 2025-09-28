import { BigNumber } from "bignumber.js"
import { blogger } from "../common/base/logger.js";
import { EExchange } from "../common/exchange.enum.js";
import { rdsClient } from "../common/db/redis.js";
import { TExchangeMarkprice, TExchangeOrderbook } from "../common/types/exchange.type.js";
import { RedisKeyMgr } from "../common/redis.key.js";
import { TExchangeTokenInfo, TokenInfoService } from "../service/tokenInfo.service.js";
import { ExchangeAdapter } from "../exchanges/exchange.adapter.js";
import { TSMap } from "../libs/tsmap.js";

const orderbookTimeDiff = 5 // 5秒

export class ExchangeDataMgr {
  traceId: string

  constructor(traceId: string) {
    this.traceId = traceId
  }

  /*
  * 获取某交易所指定symbol的订单簿
  * @param exchange 交易所 如 BINANCE
  * @param symbol 交易对 如 BTCUSDT
  * @returns 订单簿
  */
  async getOrderBook(exchange: EExchange, symbol: string): Promise<TExchangeOrderbook | undefined> {
    const currentTime = Date.now()
    let orderbooKey = RedisKeyMgr.FutureUOrderbookKey(exchange, symbol)
    const orderbookStr = await rdsClient.get(orderbooKey)
    if (!orderbookStr) {
      blogger.error(`${this.traceId} get ${exchange} OrderBook, key: ${orderbooKey} not found`)
      return
    }
    const orderbook = JSON.parse(orderbookStr) as TExchangeOrderbook
    const updatetime = orderbook.updatetime
    if (currentTime - updatetime > orderbookTimeDiff) {
      blogger.warn(`${this.traceId} getOrderBook: ${orderbooKey} is too old, skip, updatetime: ${updatetime}, currentTime: ${currentTime}`)
      return
    }
    return orderbook
  }

  /*
  * 获取某交易所指定symbol的index price
  * @param exchange 交易所 如 BINANCE
  * @param symbol 交易对 如 BTCUSDT
  * @returns index price
  */
  async getIndexPrice(exchange: EExchange, symbol: string): Promise<BigNumber | undefined> {
    const tickerKey = `${exchange.toUpperCase()}:MARKET:0:FUTURE_U:TICKER:${symbol.toUpperCase()}`
    const tickerStr = await rdsClient.get(tickerKey)
    if (!tickerStr) {
      blogger.error(`${this.traceId} getIndexPrice, key: ${tickerKey} not found`)
      return
    }
    const ticker = JSON.parse(tickerStr) as TExchangeMarkprice
    const indexPrice = BigNumber(ticker.indexPrice)
    return indexPrice
  }

  /*
  * 获取交易所列表中某代币的index price，循环查询
  * @param exchangeList 交易所列表
  * @param baseToken 基础货币
  * @returns index price
  */
  async getIndexPrice2(exchangeList: ExchangeAdapter[], chainToken: string, exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>): Promise<BigNumber | undefined> {
    for (const exchange of exchangeList) {
      const key = TokenInfoService.getExchangeTokenKey(exchange.exchangeName, chainToken)
      const exchangeInfo = exchangeTokenInfoMap.get(key)
      if (!exchangeInfo) {
        blogger.warn(`${this.traceId} chainToken: ${chainToken} getIndexPrice2 not found in tokenInfoMap, key: ${key}, exchangeTokenInfoMap: ${JSON.stringify(exchangeTokenInfoMap.keys())}`)
        continue
      }
      const exchangeTokenInfo = exchangeInfo.exchangeTokenInfo
      const symbol = exchange.generateOrderbookSymbol(exchangeTokenInfo.exchangeToken)
      const indexPrice = await this.getIndexPrice(exchange.exchangeName, symbol)
      if (!indexPrice) {
        continue
      }
      return indexPrice
    }
    return
  }
}
