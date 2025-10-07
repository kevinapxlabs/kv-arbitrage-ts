import { EExchange } from "../common/exchange.enum.js";
import { rdsClient } from "../common/db/redis.js";
import { TExchangeFundingFee, TExchangeMarkprice } from "../common/types/exchange.type.js";
import { RedisKeyMgr } from "../common/redis.key.js";

export class CrossCreateData {
  // 设置交易所的orderbook
  async setOrderbook(exchange: EExchange, symbol: string, asks: string[], bids: string[]) {
    const orderbookKey = RedisKeyMgr.FutureUOrderbookKey(exchange, symbol)
    const orderbook = {
      updatetime: Date.now(),
      asks: [asks],
      bids: [bids],
    }
    await rdsClient.set(orderbookKey, JSON.stringify(orderbook), 10 * 3600)
  }

  // 设置交易所的funding fee
  async setMarketPriceData(exchange: EExchange, symbol: string, indexPrice: string, fundingFee: string) {
    const fundingFeeKey = RedisKeyMgr.MarketPriceKey(exchange, symbol)
    const ticker: TExchangeMarkprice = {
      indexPrice: indexPrice,
      markPrice: indexPrice,
      updatetime: Date.now(),
    }
    await rdsClient.set(fundingFeeKey, JSON.stringify(ticker), 10 * 3600)
  }

  async setFundingRateData(exchange: EExchange, symbol: string, fundingRate: string) {
    const nextFundingTime = Date.now() + 5 * 3600 * 100
    const fundingRateKey = RedisKeyMgr.FundingRateKey(exchange, symbol)
    const fundingRateData: TExchangeFundingFee = {
      rate: fundingRate,
      nextFundingTime: nextFundingTime,
      updatetime: Date.now(),
    }
    await rdsClient.set(fundingRateKey, JSON.stringify(fundingRateData), 10 * 3600)
  }

  async setLINKData() {
    await this.setMarketPriceData(EExchange.Aster, 'LINKUSDT', '101', '0.003')
    await this.setMarketPriceData(EExchange.Backpack, 'LINK_USDC_PERP', '102', '0.0008')
    await this.setFundingRateData(EExchange.Aster, 'LINKUSDT', '0.0008')
    await this.setFundingRateData(EExchange.Backpack, 'LINK_USDC_PERP', '0.00009')
    await this.setOrderbook(EExchange.Aster, 'LINKUSDT', ['109', '100000000'], ["103", "100000000"])
    await this.setOrderbook(EExchange.Backpack, 'LINK_USDC_PERP', ['101', '100000000'], ["100", "100000000"])
  }

  async setBtCData() {
    await this.setMarketPriceData(EExchange.Aster, 'BTCUSDT', '110000', '0.000057')
    await this.setMarketPriceData(EExchange.Backpack, 'BTC_USDC_PERP', '110001', '0.000058')
    await this.setFundingRateData(EExchange.Aster, 'BTCUSDT', '0.000058')
    await this.setFundingRateData(EExchange.Backpack, 'BTC_USDC_PERP', '0.00038')
    await this.setOrderbook(EExchange.Aster, 'BTCUSDT', ['110005', '100000000'], ["110006", "100000000"])
    await this.setOrderbook(EExchange.Backpack, 'BTC_USDC_PERP', ['110007', '100000000'], ["110008", "100000000"])
  }

  async createData() {
    // 1. LINK
    await this.setLINKData()

    // 2. BTC
    await this.setBtCData()

    console.log('create test data ok')
  }
}