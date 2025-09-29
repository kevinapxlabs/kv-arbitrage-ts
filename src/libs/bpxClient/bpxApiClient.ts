import { BpxHttpHandler } from './http/bpxHttpHandler.js';

// Public APIs
import { AssetsApi } from './http/public/assets/assets.api.js';
import { BorrowLendMarketsApi } from './http/public/borrowLendMarkets/borrowLendMarkets.api.js';
import { MarketsApi } from './http/public/markets/markets.api.js';
import { SystemApi } from './http/public/system/system.api.js';
import { TradesApi } from './http/public/trades/trades.api.js';

// Authenticated APIs
import { AccountApi } from './http/private/account/account.api.js';
import { BorrowLendApi } from './http/private/borrowLend/borrowLend.api.js';
import { CapitalApi } from './http/private/capital/capital.api.js';
import { FuturesApi } from './http/private/futures/futures.api.js';
import { HistoryApi } from './http/private/history/history.api.js';
import { OrderApi } from './http/private/order/order.api.js';

// WebSocket APIs
import { StreamsApi } from './websocket/streams.api.js';

// Authentication
import { BpxCredentials } from './authentication/bpxCredentials.js';

export class BpxApiClient {

  private readonly auth: BpxCredentials;

  public readonly assets: AssetsApi;
  public readonly borrowLendMarkets: BorrowLendMarketsApi;
  public readonly markets: MarketsApi;
  public readonly system: SystemApi;
  public readonly trades: TradesApi;

  public readonly account: AccountApi;
  public readonly borrowLend: BorrowLendApi;
  public readonly capital: CapitalApi;
  public readonly futures: FuturesApi;
  public readonly history: HistoryApi;
  public readonly order: OrderApi;

  public readonly streams: StreamsApi;

  constructor(config: BpxConfig) {
    
    this.auth = new BpxCredentials(config.apiKey, config.apiSecret);
    const httpHandler = new BpxHttpHandler(this.auth, { debug: config.debug, httpUrl: config.httpUrl });
    
    // Public APIs
    this.assets = new AssetsApi(httpHandler);
    this.borrowLendMarkets = new BorrowLendMarketsApi(httpHandler);
    this.markets = new MarketsApi(httpHandler);
    this.system = new SystemApi(httpHandler);
    this.trades = new TradesApi(httpHandler);

    // Private APIs
    this.account = new AccountApi(httpHandler);
    this.borrowLend = new BorrowLendApi(httpHandler);
    this.capital = new CapitalApi(httpHandler);
    this.futures = new FuturesApi(httpHandler);
    this.history = new HistoryApi(httpHandler);
    this.order = new OrderApi(httpHandler);

    // WebSocket APIs
    this.streams = new StreamsApi(this.auth, { wsUrl: config.wsUrl, debug: config.debug });
  }
}

export interface BpxConfig {
  apiKey: string;
  apiSecret: string;
  httpUrl?: string;
  wsUrl?: string;
  debug?: boolean;
}