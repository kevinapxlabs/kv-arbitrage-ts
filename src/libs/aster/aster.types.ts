import {
  AsterContractStatus,
  AsterContractType,
  AsterIncomeType,
  AsterMarginChangeType,
  AsterMarginType,
  AsterNewOrderRespType,
  AsterOrderSide,
  AsterOrderStatus,
  AsterOrderType,
  AsterPositionSide,
  AsterTimeInForce,
  AsterWorkingType,
} from './aster.enums';

export type AsterNumeric = string | number;
export type AsterOrderbookLevel = [string, string];

export interface AsterSignedRequest extends Record<string, unknown> {
  recvWindow?: number;
}

export type AsterKlineInterval =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '8h'
  | '12h'
  | '1d'
  | '3d'
  | '1w'
  | '1M';

export interface AsterServerTimeResponse {
  serverTime: number;
}

export interface AsterRateLimit {
  rateLimitType: string;
  interval: string;
  intervalNum: number;
  limit: number;
  count?: number;
}

export interface AsterExchangeFilter {
  filterType: string;
  [key: string]: string | number | boolean | undefined;
}

export interface AsterExchangeAsset {
  asset: string;
  marginAvailable: boolean;
  autoAssetExchange: number | null;
}

export interface AsterSymbolInfo {
  symbol: string;
  pair: string;
  contractType: AsterContractType;
  deliveryDate: number;
  onboardDate: number;
  status: AsterContractStatus;
  maintMarginPercent: string;
  requiredMarginPercent?: string;
  baseAsset: string;
  quoteAsset: string;
  marginAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
  baseAssetPrecision: number;
  quotePrecision: number;
  underlyingType?: string;
  underlyingSubType?: string[];
  settlePlan?: number;
  triggerProtect: string;
  filters: AsterExchangeFilter[];
  orderTypes?: AsterOrderType[];
  timeInForce: AsterTimeInForce[];
  liquidationFee: string;
  marketTakeBound: string;
  defaultSelfTradePreventionMode?: string;
  allowedSelfTradePreventionModes?: string[];
  contractSize?: number;
  defaultQuantity?: string;
}

export interface AsterExchangeInfo {
  timezone: string;
  serverTime: number;
  rateLimits: AsterRateLimit[];
  exchangeFilters: AsterExchangeFilter[];
  assets: AsterExchangeAsset[];
  symbols: AsterSymbolInfo[];
}

export interface AsterDepthSnapshot {
  lastUpdateId: number;
  E?: number;
  T?: number;
  bids: AsterOrderbookLevel[];
  asks: AsterOrderbookLevel[];
}

export interface AsterRecentTrade {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
  isBestMatch?: boolean;
}

export type AsterHistoricalTrade = AsterRecentTrade & {
  isBestMatch: boolean;
};

export interface AsterAggregateTrade {
  a: number;
  p: string;
  q: string;
  f: number;
  l: number;
  T: number;
  m: boolean;
  M: boolean;
}

export type AsterKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string
];

export type AsterMarkPriceKline = AsterKline;
export type AsterIndexPriceKline = AsterKline;

export interface AsterPremiumIndex {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  estimatedSettlePrice: string;
  lastFundingRate?: string;
  nextFundingTime?: number;
  interestRate?: string;
  time: number;
}

export interface AsterFundingRateEntry {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
  markPrice?: string;
  indexPrice?: string;
  estimatedRate?: string;
}

export interface AsterFundingInfoEntry {
  symbol: string;
  interestRate: string;
  time: number;
  fundingIntervalHours: number;
  fundingFeeCap: number;
  fundingFeeFloor: number;
}

export interface Aster24hrTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  lastPrice: string;
  lastQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export interface AsterTickerPrice {
  symbol: string;
  price: string;
  time?: number;
}

export interface AsterBookTicker {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  time?: number;
}

export interface AsterDepthQuery extends Record<string, unknown> {
  symbol: string;
  limit?: number;
}

export interface AsterRecentTradesQuery extends Record<string, unknown> {
  symbol: string;
  limit?: number;
}

export interface AsterHistoricalTradesQuery extends Record<string, unknown> {
  symbol: string;
  limit?: number;
  fromId?: number;
}

export interface AsterAggregateTradesQuery extends Record<string, unknown> {
  symbol: string;
  fromId?: number;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface AsterKlinesQuery extends Record<string, unknown> {
  symbol: string;
  interval: AsterKlineInterval;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface AsterFundingRateQuery extends Record<string, unknown> {
  symbol?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface AsterFundingInfoQuery extends Record<string, unknown> {
  symbol?: string;
}

export interface AsterPremiumIndexQuery extends Record<string, unknown> {
  symbol?: string;
}

export interface Aster24hrTickerQuery extends Record<string, unknown> {
  symbol?: string;
}

export interface AsterTickerPriceQuery extends Record<string, unknown> {
  symbol?: string;
}

export interface AsterBookTickerQuery extends Record<string, unknown> {
  symbol?: string;
}

export interface AsterPositionSideDualResponse {
  dualSidePosition: boolean;
}

export interface AsterMultiAssetsMarginResponse {
  multiAssetsMargin: boolean;
}

export interface AsterPositionSideDualRequest extends AsterSignedRequest {
  dualSidePosition: boolean;
}

export interface AsterMultiAssetsMarginRequest extends AsterSignedRequest {
  multiAssetsMargin: boolean;
}

export interface AsterNewOrderRequest extends AsterSignedRequest {
  symbol: string;
  side: AsterOrderSide;
  type: AsterOrderType;
  positionSide?: AsterPositionSide;
  reduceOnly?: boolean;
  quantity?: AsterNumeric;
  price?: AsterNumeric;
  newClientOrderId?: string;
  stopPrice?: AsterNumeric;
  closePosition?: boolean;
  activationPrice?: AsterNumeric;
  callbackRate?: AsterNumeric;
  timeInForce?: AsterTimeInForce;
  workingType?: AsterWorkingType;
  priceProtect?: boolean;
  newOrderRespType?: AsterNewOrderRespType;
}

export type AsterBatchOrderRequestItem = AsterNewOrderRequest;

export interface AsterBatchOrdersRequest extends AsterSignedRequest {
  orders: AsterBatchOrderRequestItem[];
}

export interface AsterCancelOrderRequest extends AsterSignedRequest {
  symbol: string;
  orderId?: number;
  origClientOrderId?: string;
}

export interface AsterCancelAllOpenOrdersRequest extends AsterSignedRequest {
  symbol: string;
}

export interface AsterBatchCancelOrderRequest extends AsterSignedRequest {
  symbol: string;
  orderIdList?: number[];
  origClientOrderIdList?: string[];
}

export interface AsterQueryOrderRequest extends AsterSignedRequest {
  symbol: string;
  orderId?: number;
  origClientOrderId?: string;
}

export interface AsterOpenOrdersQuery extends AsterSignedRequest {
  symbol?: string;
}

export interface AsterCountdownCancelRequest extends AsterSignedRequest {
  symbol: string;
  countdownTime: number;
}

export interface AsterWalletTransferRequest extends AsterSignedRequest {
  amount: AsterNumeric;
  asset: string;
  clientTranId: string;
  kindType: 'FUTURE_SPOT' | 'SPOT_FUTURE';
}

export interface AsterWalletTransferResponse {
  tranId: number;
  status: string;
}

export interface AsterAllOrdersQuery extends AsterSignedRequest {
  symbol: string;
  orderId?: number;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface AsterPositionMarginHistoryQuery extends AsterSignedRequest {
  symbol: string;
  type?: AsterMarginChangeType;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface AsterUserTradesQuery extends AsterSignedRequest {
  symbol: string;
  startTime?: number;
  endTime?: number;
  fromId?: number;
  limit?: number;
}

export interface AsterIncomeQuery extends AsterSignedRequest {
  symbol?: string;
  incomeType?: AsterIncomeType;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface AsterForceOrdersQuery extends AsterSignedRequest {
  symbol?: string;
  autoCloseType?: 'LIQUIDATION' | 'ADL';
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface AsterLeverageBracketQuery extends AsterSignedRequest {
  symbol?: string;
}

export interface AsterAdlQuantileQuery extends AsterSignedRequest {
  symbol?: string;
}

export interface AsterCommissionRateQuery extends AsterSignedRequest {
  symbol: string;
}

export interface AsterGetOpenOrderRequest extends AsterQueryOrderRequest {}

export interface AsterOrderBase {
  avgPrice: string;
  clientOrderId: string;
  cumQuote: string;
  executedQty: string;
  orderId: number;
  origQty: string;
  price: string;
  reduceOnly: boolean;
  side: AsterOrderSide;
  positionSide: AsterPositionSide;
  status: AsterOrderStatus;
  stopPrice: string;
  closePosition: boolean;
  symbol: string;
  timeInForce: AsterTimeInForce;
  type: AsterOrderType;
  origType?: AsterOrderType;
  activatePrice?: string | null;
  priceRate?: string | null;
  updateTime: number;
  workingType: AsterWorkingType;
  priceProtect: boolean;
  cumQty?: string;
  cumBase?: string;
}

export interface AsterCreateOrderResponse extends AsterOrderBase {}
export interface AsterTestOrderResponse extends Record<string, unknown> {}
export interface AsterCancelOrderResponse extends AsterOrderBase {}
export interface AsterQueryOrderResponse extends AsterOrderBase {
  time?: number;
}

export type AsterBatchOrderResponseItem =
  | AsterOrderBase
  | {
      code: number;
      msg: string;
    };

export type AsterBatchOrderResponse = AsterBatchOrderResponseItem[];

export interface AsterCancelAllOpenOrdersResponse {
  code: number | string;
  msg: string;
}

export interface AsterCountdownCancelResponse {
  symbol: string;
  countdownTime: string;
}

export interface AsterPositionRisk {
  entryPrice: string;
  marginType: AsterMarginType;
  isAutoAddMargin: string;
  isolatedMargin: string;
  leverage: string;
  liquidationPrice: string;
  markPrice: string;
  maxNotionalValue: string;
  positionAmt: string;
  symbol: string;
  unRealizedProfit: string;
  positionSide: AsterPositionSide;
  notional: string;
  isolatedWallet?: string;
  updateTime: number;
}

export interface AsterAccountBalanceEntry {
  accountAlias: string;
  asset: string;
  balance: string;
  crossWalletBalance: string;
  crossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  marginAvailable: boolean;
  updateTime: number;
}

export interface AsterAccountAsset {
  asset: string;
  walletBalance: string;
  unrealizedProfit: string;
  marginBalance: string;
  maintMargin: string;
  initialMargin: string;
  positionInitialMargin: string;
  openOrderInitialMargin: string;
  crossWalletBalance: string;
  crossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  marginAvailable: boolean;
  updateTime: number;
}

export interface AsterAccountPosition {
  symbol: string;
  initialMargin: string;
  maintMargin: string;
  unrealizedProfit: string;
  positionInitialMargin: string;
  openOrderInitialMargin: string;
  leverage: string;
  isolated: boolean;
  entryPrice: string;
  maxNotional: string;
  positionSide: AsterPositionSide;
  positionAmt: string;
  updateTime: number;
}

export interface AsterAccountInfoResponse {
  feeTier: number;
  canTrade: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  updateTime: number;
  totalInitialMargin: string;
  totalMaintMargin: string;
  totalWalletBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  totalPositionInitialMargin: string;
  totalOpenOrderInitialMargin: string;
  totalCrossWalletBalance: string;
  totalCrossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  assets: AsterAccountAsset[];
  positions: AsterAccountPosition[];
}

export interface AsterLeverageResponse {
  leverage: number;
  maxNotionalValue: string;
  symbol: string;
}

export interface AsterLeverageRequest extends AsterSignedRequest {
  symbol: string;
  leverage: number;
}

export interface AsterMarginTypeResponse {
  code: number;
  msg: string;
}

export interface AsterMarginTypeRequest extends AsterSignedRequest {
  symbol: string;
  marginType: AsterMarginType;
}

export interface AsterPositionMarginRequest extends AsterSignedRequest {
  symbol: string;
  amount: AsterNumeric;
  type: AsterMarginChangeType;
  positionSide?: AsterPositionSide;
}

export interface AsterPositionMarginResponse {
  amount: number;
  code: number;
  msg: string;
  type: AsterMarginChangeType;
}

export interface AsterPositionMarginHistoryEntry {
  amount: string;
  asset: string;
  symbol: string;
  time: number;
  type: AsterMarginChangeType;
  positionSide: AsterPositionSide;
}

export interface AsterUserTrade {
  symbol: string;
  id: number;
  orderId: number;
  side: AsterOrderSide;
  positionSide: AsterPositionSide;
  price: string;
  qty: string;
  quoteQty: string;
  realizedPnl: string;
  marginAsset?: string;
  commission: string;
  commissionAsset: string;
  time: number;
  buyer: boolean;
  maker: boolean;
}

export interface AsterIncomeRecord {
  symbol: string;
  incomeType: AsterIncomeType;
  income: string;
  asset: string;
  info: string;
  time: number;
  tranId: string;
  tradeId: string;
}

export interface AsterLeverageBracketLevel {
  bracket: number;
  initialLeverage: number;
  notionalCap: number;
  notionalFloor: number;
  maintMarginRatio: number;
  cum: number;
}

export interface AsterLeverageBracket {
  symbol: string;
  brackets: AsterLeverageBracketLevel[];
}

export type AsterLeverageBracketResponse = AsterLeverageBracket | AsterLeverageBracket[];

export interface AsterAdlQuantileEntry {
  symbol: string;
  adlQuantile: Record<string, number>;
}

export interface AsterForceOrder {
  orderId: number;
  symbol: string;
  status: AsterOrderStatus;
  clientOrderId: string;
  price: string;
  avgPrice: string;
  origQty: string;
  executedQty: string;
  cumQuote: string;
  timeInForce: AsterTimeInForce;
  type: AsterOrderType;
  reduceOnly: boolean;
  closePosition: boolean;
  side: AsterOrderSide;
  positionSide: AsterPositionSide;
  stopPrice: string;
  workingType: AsterWorkingType;
  origType: AsterOrderType;
  time: number;
  updateTime: number;
  autoCloseType?: 'LIQUIDATION' | 'ADL';
}

export interface AsterCommissionRate {
  symbol: string;
  makerCommissionRate: string;
  takerCommissionRate: string;
}

export interface AsterListenKeyResponse {
  listenKey: string;
}

export interface AsterGenericResponse {
  code: number;
  msg: string;
}
