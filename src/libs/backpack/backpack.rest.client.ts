import { BackpackClientConfig } from './backpack.client';
import { BackpackPublicApi } from './backpack.public.api';
import { BackpackAccountApi } from './backpack.account.api';
import { BackpackTradingApi } from './backpack.trading.api';
import { BackpackHistoryApi } from './backpack.history.api';

export class BackpackClient {
  readonly publicApi: BackpackPublicApi;
  readonly accountApi: BackpackAccountApi;
  readonly tradingApi: BackpackTradingApi;
  readonly historyApi: BackpackHistoryApi;

  constructor(config: BackpackClientConfig = {}) {
    this.publicApi = new BackpackPublicApi(config);
    this.accountApi = new BackpackAccountApi(config);
    this.tradingApi = new BackpackTradingApi(config);
    this.historyApi = new BackpackHistoryApi(config);
  }
}
