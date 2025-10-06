import { AsterApiBase, AsterClientConfig } from './aster.client.js';
import {
  Aster24hrTicker,
  Aster24hrTickerQuery,
  AsterAggregateTrade,
  AsterAggregateTradesQuery,
  AsterBookTicker,
  AsterBookTickerQuery,
  AsterDepthQuery,
  AsterDepthSnapshot,
  AsterExchangeInfo,
  AsterFundingInfoEntry,
  AsterFundingInfoQuery,
  AsterFundingRateEntry,
  AsterFundingRateQuery,
  AsterHistoricalTrade,
  AsterHistoricalTradesQuery,
  AsterIndexPriceKline,
  AsterKline,
  AsterKlinesQuery,
  AsterMarkPriceKline,
  AsterPremiumIndex,
  AsterPremiumIndexQuery,
  AsterRecentTrade,
  AsterRecentTradesQuery,
  AsterServerTimeResponse,
  AsterTickerPrice,
  AsterTickerPriceQuery,
} from './aster.types';

export class AsterMarketApi extends AsterApiBase {
  constructor(config: AsterClientConfig = {}) {
    super(config);
  }

  async ping(): Promise<void> {
    await this.getPublic<Record<string, never>>('/fapi/v1/ping');
  }

  async getServerTime(): Promise<AsterServerTimeResponse> {
    return this.getPublic<AsterServerTimeResponse>('/fapi/v1/time');
  }

  async getExchangeInfo(): Promise<AsterExchangeInfo> {
    return this.getPublic<AsterExchangeInfo>('/fapi/v1/exchangeInfo');
  }

  async getDepth(params: AsterDepthQuery): Promise<AsterDepthSnapshot> {
    return this.getPublic<AsterDepthSnapshot>('/fapi/v1/depth', params);
  }

  async getRecentTrades(params: AsterRecentTradesQuery): Promise<AsterRecentTrade[]> {
    return this.getPublic<AsterRecentTrade[]>('/fapi/v1/trades', params);
  }

  async getHistoricalTrades(params: AsterHistoricalTradesQuery): Promise<AsterHistoricalTrade[]> {
    return this.request<AsterHistoricalTrade[]>('GET', '/fapi/v1/historicalTrades', {
      params,
      useApiKey: true,
    });
  }

  async getAggregateTrades(params: AsterAggregateTradesQuery): Promise<AsterAggregateTrade[]> {
    return this.getPublic<AsterAggregateTrade[]>('/fapi/v1/aggTrades', params);
  }

  async getKlines(params: AsterKlinesQuery): Promise<AsterKline[]> {
    return this.getPublic<AsterKline[]>('/fapi/v1/klines', params);
  }

  async getIndexPriceKlines(params: AsterKlinesQuery): Promise<AsterIndexPriceKline[]> {
    return this.getPublic<AsterIndexPriceKline[]>('/fapi/v1/indexPriceKlines', params);
  }

  async getMarkPriceKlines(params: AsterKlinesQuery): Promise<AsterMarkPriceKline[]> {
    return this.getPublic<AsterMarkPriceKline[]>('/fapi/v1/markPriceKlines', params);
  }

  async getPremiumIndex(
    params?: AsterPremiumIndexQuery
  ): Promise<AsterPremiumIndex | AsterPremiumIndex[]> {
    return this.getPublic<AsterPremiumIndex | AsterPremiumIndex[]>('/fapi/v1/premiumIndex', params);
  }

  async getFundingRate(params?: AsterFundingRateQuery): Promise<AsterFundingRateEntry[]> {
    return this.getPublic<AsterFundingRateEntry[]>('/fapi/v1/fundingRate', params);
  }

  async getFundingInfo(params?: AsterFundingInfoQuery): Promise<AsterFundingInfoEntry[]> {
    return this.getPublic<AsterFundingInfoEntry[]>('/fapi/v1/fundingInfo', params);
  }

  async get24hrTicker(
    params?: Aster24hrTickerQuery
  ): Promise<Aster24hrTicker | Aster24hrTicker[]> {
    return this.getPublic<Aster24hrTicker | Aster24hrTicker[]>('/fapi/v1/ticker/24hr', params);
  }

  async getTickerPrice(
    params?: AsterTickerPriceQuery
  ): Promise<AsterTickerPrice | AsterTickerPrice[]> {
    return this.getPublic<AsterTickerPrice | AsterTickerPrice[]>('/fapi/v1/ticker/price', params);
  }

  async getBookTicker(
    params?: AsterBookTickerQuery
  ): Promise<AsterBookTicker | AsterBookTicker[]> {
    return this.getPublic<AsterBookTicker | AsterBookTicker[]>('/fapi/v1/ticker/bookTicker', params);
  }
}
