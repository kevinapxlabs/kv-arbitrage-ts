import { EExchange } from "./exchange.enum.js";

export class RedisKeyMgr {
  // exchange future u orderbook
  static FutureUOrderbookKey(exchange: EExchange, symbol: string) {
    return `KV:${exchange}:FUTUREU:ORDERBOOK:${symbol.toUpperCase()}`;
  }

  static MarketPriceKey(exchange: EExchange, symbol: string) {
    return `KV:${exchange}:MARKETPRICE:${symbol.toUpperCase()}`;
  }

  static FundingRateKey(exchange: EExchange, symbol: string) {
    return `KV:${exchange}:FUNDINGRATE:${symbol.toUpperCase()}`;
  }

  static FundingIntervalKey(exchange: EExchange) {
    return `KV:${exchange}:FUNDINGINTERVAL`;
  }

  // 保存交易所交易交易规则和交易对
  static MarketInfoKey(exchange: EExchange) {
    return `KV:${exchange}:MARKETINFO`;
  }

  static arbitrageConfigKey(key: string) {
    return `APX:${key.toUpperCase()}:ARBITRAGE:CONFIG`
  }

  // 保存交易所交易交易时间 毫秒级时间戳
  static positionOpenTimestampKey(chainToken: string, baseExchange: string, quoteExchange: string) {
    return `KV:POSITION:OPEN:TIMESTAMP:${chainToken}:${baseExchange}:${quoteExchange}`
  }
}
