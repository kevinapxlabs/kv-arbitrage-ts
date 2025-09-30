import BigNumber from "bignumber.js"
import { blogger } from "../common/base/logger.js"
import { ExchangeDataMgr } from "./exchange.data.js"
import { UtilsMgr } from "./utils.js"
import { EKVSide } from "../common/exchange.enum.js"
import { ExchangeAdapter } from "../exchanges/exchange.adapter.js"

export class ArbitrageBase {
  traceId: string
  private exchangeDataMgr?: ExchangeDataMgr

  constructor(traceId: string) {
    this.traceId = traceId
  }

  protected getExchangeDataMgr(): ExchangeDataMgr {
    // ExchangeDataMgr embeds traceId in log context, refresh when traceId changes
    if (!this.exchangeDataMgr) {
      this.exchangeDataMgr = new ExchangeDataMgr(this.traceId)
    }
    return this.exchangeDataMgr
  }

  /*
  * 获取交易所间价差
  * @param baseExchange side 方向
  * @param baseToken 基础货币
  * @param baseExchange 基础交易所
  * @param quoteExchange 报价交易所
  * @returns 价差
  */
  async getPriceDelta(trace2: string, side: EKVSide, baseExchangeToken: string, baseExchange: ExchangeAdapter, quoteExchangeToken: string, quoteExchange: ExchangeAdapter): Promise<number | undefined> {
    const baseSymbol = baseExchange.generateOrderbookSymbol(baseExchangeToken)
    const exchangeDataMgr = this.getExchangeDataMgr()
    const baseOrderbook = await exchangeDataMgr.getOrderBook(baseExchange.exchangeName, baseSymbol)
    if (!baseOrderbook) {
      blogger.info(`${this.traceId} ${trace2}, orderbook ${baseSymbol} not found, exchange: ${baseExchange.exchangeName}`)
      return
    }
    if (baseOrderbook.bids.length === 0 || baseOrderbook.asks.length === 0) {
      blogger.info(`${this.traceId} ${trace2}, orderbook ${baseSymbol} is empty, exchange: ${baseExchange.exchangeName}`)
      return
    }
    const quoteSymbol = quoteExchange.generateOrderbookSymbol(quoteExchangeToken)
    const quoteOrderbook = await exchangeDataMgr.getOrderBook(quoteExchange.exchangeName, quoteSymbol)
    if (!quoteOrderbook) {
      blogger.info(`${this.traceId} ${trace2}, orderbook ${quoteSymbol} not found, exchange: ${quoteExchange.exchangeName}`)
      return
    }
    if (quoteOrderbook.bids.length === 0 || quoteOrderbook.asks.length === 0) {
      blogger.info(`${this.traceId} ${trace2}, orderbook ${quoteSymbol} is empty, exchange: ${quoteExchange.exchangeName}`)
      return
    }
    const baseBid1 = BigNumber(baseOrderbook.bids[0][0]), baseAsk1  = BigNumber(baseOrderbook.asks[0][0])
    const quoteBid1 = BigNumber(quoteOrderbook.bids[0][0]), quoteAsk1 = BigNumber(quoteOrderbook.asks[0][0])
    blogger.info(`${this.traceId}, ${trace2}, baseToken: ${baseExchangeToken}, quoteToken: ${quoteExchangeToken}, side: ${side}, baseBid1: ${baseBid1}, baseAsk1: ${baseAsk1}, quoteBid1: ${quoteBid1}, quoteAsk1: ${quoteAsk1}`)
    const priceDelta = UtilsMgr.getPriceDelta(side, baseBid1, baseAsk1, quoteBid1, quoteAsk1)
    return priceDelta
  }
}
