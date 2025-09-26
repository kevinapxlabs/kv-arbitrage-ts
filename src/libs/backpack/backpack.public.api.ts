import {
  BackpackCollateralSummary,
  BackpackDepth,
  BackpackFundingIntervalRate,
  BackpackKline,
  BackpackMarkPrice,
  BackpackMarket,
  BackpackMarketAsset,
  BackpackOpenInterest,
  BackpackStatusAndMessage,
  BackpackTicker,
  BackpackTrade,
  BackpackWalletResponse,
} from './backpack.types';
import {
  BackpackDepthQuery,
  BackpackFundingRatesQuery,
  BackpackKlinesQuery,
  BackpackOptionalSymbolQuery,
  BackpackSymbolQuery,
  BackpackTickerQuery,
  BackpackTickersQuery,
  BackpackTradesQuery,
  BackpackTradeHistoryQuery,
} from './backpack.interfaces';
import { BackpackApiBase } from './backpack.client';

export class BackpackPublicApi extends BackpackApiBase {
  async ping(): Promise<string> {
    return this.request<string>('GET', '/api/v1/ping');
  }

  async getStatus(): Promise<BackpackStatusAndMessage> {
    return this.getPublic<BackpackStatusAndMessage>('/api/v1/status');
  }

  async getServerTime(): Promise<string> {
    return this.request<string>('GET', '/api/v1/time');
  }

  async getAssets(): Promise<BackpackMarketAsset[]> {
    return this.getPublic<BackpackMarketAsset[]>('/api/v1/assets');
  }

  async getCollateralParameters(): Promise<BackpackCollateralSummary[]> {
    return this.getPublic<BackpackCollateralSummary[]>('/api/v1/collateral');
  }

  async getMarkets(): Promise<BackpackMarket[]> {
    return this.getPublic<BackpackMarket[]>('/api/v1/markets');
  }

  async getMarket(params: BackpackSymbolQuery): Promise<BackpackMarket> {
    return this.getPublic<BackpackMarket>('/api/v1/market', params);
  }

  async getTicker(params: BackpackTickerQuery): Promise<BackpackTicker> {
    return this.getPublic<BackpackTicker>('/api/v1/ticker', params);
  }

  async getTickers(params?: BackpackTickersQuery): Promise<BackpackTicker[]> {
    return this.getPublic<BackpackTicker[]>('/api/v1/tickers', params);
  }

  async getDepth(params: BackpackDepthQuery): Promise<BackpackDepth> {
    return this.getPublic<BackpackDepth>('/api/v1/depth', params);
  }

  async getKlines(params: BackpackKlinesQuery): Promise<BackpackKline[]> {
    return this.getPublic<BackpackKline[]>('/api/v1/klines', params);
  }

  async getMarkPrices(params?: BackpackOptionalSymbolQuery): Promise<BackpackMarkPrice[]> {
    return this.getPublic<BackpackMarkPrice[]>('/api/v1/markPrices', params);
  }

  async getOpenInterest(params: BackpackSymbolQuery): Promise<BackpackOpenInterest> {
    return this.getPublic<BackpackOpenInterest>('/api/v1/openInterest', params);
  }

  async getFundingRates(params?: BackpackFundingRatesQuery): Promise<BackpackFundingIntervalRate[]> {
    return this.getPublic<BackpackFundingIntervalRate[]>('/api/v1/fundingRates', params);
  }

  async getTrades(params: BackpackTradesQuery): Promise<BackpackTrade[]> {
    return this.getPublic<BackpackTrade[]>('/api/v1/trades', params);
  }

  async getTradeHistory(params: BackpackTradeHistoryQuery): Promise<BackpackTrade[]> {
    return this.getPublic<BackpackTrade[]>('/api/v1/trades/history', params);
  }

  async getWallets(): Promise<BackpackWalletResponse[]> {
    return this.getPublic<BackpackWalletResponse[]>('/api/v1/wallets');
  }
}
