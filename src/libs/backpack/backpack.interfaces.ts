import {
  BackpackBorrowLendEventType,
  BackpackBorrowLendMarketHistoryInterval,
  BackpackBorrowLendPositionState,
  BackpackBorrowLendSide,
  BackpackBlockchain,
  BackpackFillType,
  BackpackInterestPaymentSource,
  BackpackKlineInterval,
  BackpackKlinePriceType,
  BackpackMarketType,
  BackpackOrderStatus,
  BackpackSide,
  BackpackSortDirection,
  BackpackStrategyTypeEnum,
  BackpackTickerInterval,
} from './backpack.types';

type BackpackQueryBase = Record<string, unknown>;

export interface BackpackPaginationQuery extends BackpackQueryBase {
  limit?: number;
  offset?: number;
}

export interface BackpackTimeRangeQuery extends BackpackQueryBase {
  from?: number;
  to?: number;
}

export interface BackpackBorrowLimitQuery extends BackpackQueryBase {
  symbol: string;
}

export interface BackpackOrderLimitQuery extends BackpackQueryBase {
  symbol: string;
  side?: BackpackSide;
  price?: string;
  reduceOnly?: boolean;
  autoBorrow?: boolean;
  autoBorrowRepay?: boolean;
  autoLendRedeem?: boolean;
}

export interface BackpackWithdrawalLimitQuery extends BackpackQueryBase {
  symbol: string;
  autoBorrow?: boolean;
  autoLendRedeem?: boolean;
}

export interface BackpackBorrowLendLiquidationPriceQuery extends BackpackQueryBase {
  subaccountId?: number;
  borrow?: string;
}

export interface BackpackBorrowLendHistoryQuery extends BackpackPaginationQuery {
  type?: BackpackBorrowLendEventType;
  sources?: string;
  positionId?: string;
  symbol?: string;
  sortDirection?: BackpackSortDirection;
}

export interface BackpackBorrowLendMarketHistoryQuery extends BackpackPaginationQuery {
  interval?: BackpackBorrowLendMarketHistoryInterval;
  symbol?: string;
}

export interface BackpackCollateralQuery extends BackpackQueryBase {
  subaccountId?: number;
}

export interface BackpackDepositHistoryQuery
  extends BackpackPaginationQuery,
    BackpackTimeRangeQuery {}

export interface BackpackDepositAddressQuery extends BackpackQueryBase {
  blockchain: BackpackBlockchain;
}

export interface BackpackTickerQuery extends BackpackQueryBase {
  symbol: string;
  interval?: BackpackTickerInterval;
}

export interface BackpackTickersQuery extends BackpackQueryBase {
  interval?: BackpackTickerInterval;
}

export interface BackpackDepthQuery extends BackpackQueryBase {
  symbol: string;
}

export interface BackpackKlinesQuery extends BackpackQueryBase {
  symbol: string;
  interval: BackpackKlineInterval;
  startTime?: number;
  endTime?: number;
  priceType?: BackpackKlinePriceType;
}

export interface BackpackSymbolQuery extends BackpackQueryBase {
  symbol: string;
}

export interface BackpackOptionalSymbolQuery extends BackpackQueryBase {
  symbol?: string;
}

export interface BackpackFundingRatesQuery extends BackpackPaginationQuery {
  symbol?: string;
}

export interface BackpackOrdersQuery extends BackpackQueryBase {
  marketType?: BackpackMarketType;
  symbol?: string;
}

export interface BackpackOrderQuery extends BackpackQueryBase {
  symbol?: string;
  orderId?: string;
  clientId?: number;
}

export interface BackpackPositionQuery extends BackpackQueryBase {
  symbol?: string;
}

export interface BackpackStrategiesQuery extends BackpackQueryBase {
  marketType?: BackpackMarketType;
  strategyType?: BackpackStrategyTypeEnum;
  symbol?: string;
}

export interface BackpackStrategyQuery extends BackpackQueryBase {
  symbol?: string;
  strategyId?: string;
  clientStrategyId?: number;
}

export interface BackpackTradesQuery extends BackpackQueryBase {
  symbol: string;
  limit?: number;
}

export interface BackpackTradeHistoryQuery extends BackpackPaginationQuery {
  symbol: string;
}

export interface BackpackWithdrawalHistoryQuery
  extends BackpackPaginationQuery,
    BackpackTimeRangeQuery {}

export interface BackpackInterestHistoryQuery extends BackpackPaginationQuery {
  asset?: string;
  symbol?: string;
  positionId?: string;
  source?: BackpackInterestPaymentSource;
  sortDirection?: BackpackSortDirection;
}

export interface BackpackBorrowLendPositionsHistoryQuery extends BackpackPaginationQuery {
  symbol?: string;
  side?: BackpackBorrowLendSide;
  state?: BackpackBorrowLendPositionState;
  sortDirection?: BackpackSortDirection;
}

export interface BackpackDustHistoryQuery extends BackpackPaginationQuery {
  id?: number;
  symbol?: string;
  sortDirection?: BackpackSortDirection;
}

export interface BackpackFillHistoryQuery
  extends BackpackPaginationQuery,
    BackpackTimeRangeQuery {
  orderId?: string;
  strategyId?: string;
  symbol?: string;
  fillType?: BackpackFillType;
  marketType?: BackpackMarketType[];
  sortDirection?: BackpackSortDirection;
}

export interface BackpackFundingHistoryQuery extends BackpackPaginationQuery {
  subaccountId?: number;
  symbol?: string;
  sortDirection?: BackpackSortDirection;
}

export interface BackpackOrderHistoryQuery extends BackpackPaginationQuery {
  orderId?: string;
  strategyId?: string;
  symbol?: string;
  marketType?: BackpackMarketType[];
  sortDirection?: BackpackSortDirection;
}

export interface BackpackRfqHistoryQuery extends BackpackPaginationQuery {
  rfqId?: string;
  symbol?: string;
  status?: BackpackOrderStatus;
  side?: BackpackSide;
  sortDirection?: BackpackSortDirection;
}

export interface BackpackQuoteHistoryQuery extends BackpackPaginationQuery {
  quoteId?: string;
  symbol?: string;
  status?: BackpackOrderStatus;
  sortDirection?: BackpackSortDirection;
}

export interface BackpackSettlementHistoryQuery extends BackpackPaginationQuery {
  source?: string;
  sortDirection?: BackpackSortDirection;
}

export interface BackpackStrategyHistoryQuery extends BackpackPaginationQuery {
  strategyId?: string;
  symbol?: string;
  marketType?: BackpackMarketType[];
  sortDirection?: BackpackSortDirection;
}
