import { blogger } from "../common/base/logger.js"
import { EKVSide, EOrderReason } from "../common/exchange.enum.js"
import { ExchangeAdapter } from "../exchanges/exchange.adapter.js"
import { sleep } from "../utils/time.util.js"

export class OrderTakerMgr {
  traceId: string
  reason: EOrderReason

  constructor(traceId: string, reason: EOrderReason) {
    this.traceId = traceId
    this.reason = reason
  }


  /* 创建市价单
   * @param exchange 交易所
   * @param symbol 交易所符号 如 BTCUSDT
   * @param side 方向 如 EKVSide.LONG
   * @param quantity 数量
   */
  async createOrder(exchange: ExchangeAdapter, symbol: string, side: EKVSide, quantity: string, reduceOnly: boolean) {
    blogger.info(`${this.traceId} create order, exchange: ${exchange.exchangeName}, symbol: ${symbol}, side: ${side}, quantity: ${quantity}`)
    const orderId = await exchange.placeMarketOrder(symbol, side, quantity, reduceOnly)
    // [0,500] 间的随机数
    const randomTime = Math.floor(Math.random() * 500)
    await sleep(1000 + randomTime)
    for (let i = 0; i < 10; i++) {
      const order = await exchange.queryOrder(symbol, orderId)
      blogger.info(`${this.traceId} exchange: ${exchange.exchangeName} query order, order: ${JSON.stringify(order)}`)
      if (order.isCompleted) {
        return
      }
      await sleep(1000)
    }
  }

  /* 创建市价单
   * @param baseExchange 基础交易所
   * @param quoteExchange 相对反向开仓交易所
   * @param baseToken 基础货币 如 BTC
   * @param side 方向 baseExchange要下单的方向
   * @param quantity 数量
   */
  async createOrderTaker(
    baseExchange: ExchangeAdapter,
    baseExchangeToken: string,
    quoteExchange: ExchangeAdapter,
    quoteExchangeToken: string,
    side: EKVSide,
    quantity: string,
    reduceOnly: boolean
  ) {
    const baseSymbol = baseExchange.generateExchangeSymbol(baseExchangeToken)
    const quoteSymbol = quoteExchange.generateExchangeSymbol(quoteExchangeToken)
    const quoteSide = side === EKVSide.LONG ? EKVSide.SHORT : EKVSide.LONG
    blogger.info(`${this.traceId} baseExchangeToken: ${baseExchangeToken} create order taker, baseExchange: ${baseExchange.exchangeName}, quoteExchangeToken: ${quoteExchangeToken} quoteExchange: ${quoteExchange.exchangeName}, qty: ${quantity}`)
    const promises = []
    // 1. 先在baseExchange上创建市价单
    promises.push(this.createOrder(baseExchange, baseSymbol, side, quantity, reduceOnly))
    // 2. 再在quoteExchange上创建市价单
    promises.push(this.createOrder(quoteExchange, quoteSymbol, quoteSide, quantity, reduceOnly))
    // 3. 等待两个市价单都创建成功
    return Promise.all(promises)
  }
}
