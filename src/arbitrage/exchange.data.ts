import BigNumber from "bignumber.js"
import { blogger } from "../common/base/logger.js";
import { EExchange } from "../common/exchange.enum.js";
import { rdsClient } from "../common/db/redis.js";
import { TExchangeFundingFee, TExchangeMarkprice, TExchangeOrderbook } from "../common/types/exchange.type.js";
import { RedisKeyMgr } from "../common/redis.key.js";
import { TExchangeTokenInfo, TokenInfoService } from "../service/tokenInfo.service.js";
import { ExchangeAdapter } from "../exchanges/exchange.adapter.js";
import { TSMap } from "../libs/tsmap.js";
import { TKVFundingFee } from "../exchanges/types.js";

const ORDERBOOK_STALE_THRESHOLD_MS = 5_000 // 5秒

function safeJsonParse<T>(value: string, context: string): T | undefined {
  try {
    return JSON.parse(value) as T
  } catch (error) {
    blogger.error(`${context} JSON parse failed`, error)
    return
  }
}

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
    const orderbookKey = RedisKeyMgr.FutureUOrderbookKey(exchange, symbol)
    const orderbookStr = await rdsClient.get(orderbookKey)
    if (!orderbookStr) {
      blogger.error(`${this.traceId} get ${exchange} OrderBook, key: ${orderbookKey} not found`)
      return
    }
    const orderbook = safeJsonParse<TExchangeOrderbook>(orderbookStr, `${this.traceId} getOrderBook: key: ${orderbookKey}`)
    if (!orderbook) {
      return
    }
    const updateTimeSeconds = Number(orderbook.updatetime)
    if (!Number.isFinite(updateTimeSeconds)) {
      blogger.warn(`${this.traceId} getOrderBook: ${orderbookKey} has invalid updatetime: ${orderbook.updatetime}`)
      return
    }
    const updateTime = updateTimeSeconds * 1_000
    if (currentTime - updateTime > ORDERBOOK_STALE_THRESHOLD_MS) {
      blogger.warn(`${this.traceId} getOrderBook: ${orderbookKey} is too old, skip, updatetime: ${updateTimeSeconds}, currentTime: ${currentTime}`)
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
    const tickerKey = RedisKeyMgr.MarketKey(exchange, symbol)
    const tickerStr = await rdsClient.get(tickerKey)
    if (!tickerStr) {
      blogger.error(`${this.traceId} getIndexPrice, key: ${tickerKey} not found`)
      return
    }
    const ticker = safeJsonParse<TExchangeMarkprice>(tickerStr, `${this.traceId} getIndexPrice: key: ${tickerKey}`)
    if (!ticker) {
      return
    }
    try {
      const indexPrice = new BigNumber(ticker.indexPrice)
      if (!indexPrice.isFinite()) {
        blogger.warn(`${this.traceId} getIndexPrice: invalid indexPrice: ${ticker.indexPrice}, key: ${tickerKey}`)
        return
      }
      return indexPrice
    } catch (error) {
      blogger.error(`${this.traceId} getIndexPrice: failed to parse indexPrice, key: ${tickerKey}`, error)
    }
    return
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

  /*
  * 获取某交易所指定symbol的funding fee
  * @param exchange 交易所 如 BINANCE
  * @param symbol 交易对 如 BTCUSDT
  * @returns funding fee
  */
  static async getFundingFee(exchange: EExchange, symbol: string): Promise<TKVFundingFee | undefined> {
    const tickerKey = RedisKeyMgr.FundingRateKey(exchange, symbol)
    const tickerStr = await rdsClient.get(tickerKey)
    if (!tickerStr) {
      blogger.error(`getFundingFee, exchange: ${exchange}, symbol: ${symbol}, key: ${tickerKey} not found`)
      return
    }
    const ticker = safeJsonParse<TExchangeFundingFee>(tickerStr, `getFundingFee: key: ${tickerKey}`)
    if (!ticker) {
      return
    }
    try {
      const fundingFee = new BigNumber(ticker.rate)
      if (!fundingFee.isFinite()) {
        blogger.warn(`getFundingFee: invalid rate: ${ticker.rate}, key: ${tickerKey}`)
        return
      }
      return { fundingFee: fundingFee, nextFundingTime: ticker.nextFundingTime }
    } catch (error) {
      blogger.error(`getFundingFee: failed to parse rate, key: ${tickerKey}`, error)
    }
    return
  }
}
