// AUTO-GENERATED TYPES FOR BACKPACK API
// Generated from docs/openapi.json

/* eslint-disable @typescript-eslint/consistent-type-definitions */
/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BackpackAccountConvertDustPayload {
  symbol?: BackpackAsset;
}
export interface BackpackAccountSummary {
  autoBorrowSettlements: boolean;
  autoLend: boolean;
  autoRealizePnl: boolean;
  autoRepayBorrows: boolean;
  borrowLimit: string;
  futuresMakerFee: string;
  futuresTakerFee: string;
  leverageLimit: string;
  limitOrders: number;
  liquidating: boolean;
  positionLimit: string;
  spotMakerFee: string;
  spotTakerFee: string;
  triggerOrders: number;
}
export interface BackpackAccountWithdrawalPayload {
  address: string;
  blockchain: BackpackBlockchain;
  clientId?: string;
  quantity: string;
  symbol: BackpackAsset;
  twoFactorToken?: string;
  autoBorrow?: boolean;
  autoLendRedeem?: boolean;
}
export type BackpackApiErrorCode = "ACCOUNT_LIQUIDATING" | "BORROW_LIMIT" | "BORROW_REQUIRES_LEND_REDEEM" | "FORBIDDEN" | "INSUFFICIENT_FUNDS" | "INSUFFICIENT_MARGIN" | "INSUFFICIENT_SUPPLY" | "INVALID_ASSET" | "INVALID_CLIENT_REQUEST" | "INVALID_MARKET" | "INVALID_ORDER" | "INVALID_PRICE" | "INVALID_POSITION_ID" | "INVALID_QUANTITY" | "INVALID_RANGE" | "INVALID_SIGNATURE" | "INVALID_SOURCE" | "INVALID_SYMBOL" | "INVALID_TWO_FACTOR_CODE" | "LEND_LIMIT" | "LEND_REQUIRES_BORROW_REPAY" | "MAINTENANCE" | "MAX_LEVERAGE_REACHED" | "NOT_IMPLEMENTED" | "ORDER_LIMIT" | "POSITION_LIMIT" | "PRECONDITION_FAILED" | "RESOURCE_NOT_FOUND" | "SERVER_ERROR" | "TIMEOUT" | "TOO_MANY_REQUESTS" | "TRADING_PAUSED" | "UNAUTHORIZED";
export interface BackpackApiErrorResponse {
  code: BackpackApiErrorCode;
  message: string;
}
export type BackpackAsset = "BTC" | "ETH" | "SOL" | "USDC" | "USDT" | "PYTH" | "JTO" | "BONK" | "HNT" | "MOBILE" | "WIF" | "JUP" | "RENDER" | "WEN" | "W" | "TNSR" | "PRCL" | "SHARK" | "KMNO" | "MEW" | "BOME" | "RAY" | "HONEY" | "SHFL" | "BODEN" | "IO" | "DRIFT" | "PEPE" | "SHIB" | "LINK" | "UNI" | "ONDO" | "FTM" | "MATIC" | "STRK" | "BLUR" | "WLD" | "GALA" | "NYAN" | "HLG" | "MON" | "ZKJ" | "MANEKI" | "HABIBI" | "UNA" | "ZRO" | "ZEX" | "AAVE" | "LDO" | "MOTHER" | "CLOUD" | "MAX" | "POL" | "TRUMPWIN" | "HARRISWIN" | "MOODENG" | "DBR" | "GOAT" | "ACT" | "DOGE" | "BCH" | "LTC" | "APE" | "ENA" | "ME" | "EIGEN" | "CHILLGUY" | "PENGU" | "EUR" | "SONIC" | "J" | "TRUMP" | "MELANIA" | "ANIME" | "XRP" | "SUI" | "VINE" | "ADA" | "MOVE" | "BERA" | "IP" | "HYPE" | "BNB" | "KAITO" | "kPEPE" | "kBONK" | "kSHIB" | "AVAX" | "S" | "POINTS" | "ROAM" | "AI16Z" | "LAYER" | "FARTCOIN" | "NEAR" | "PNUT" | "ARB" | "DOT" | "APT" | "OP" | "PYUSD" | "HUMA" | "WAL" | "DEEP" | "CETUS" | "SEND" | "BLUE" | "NS" | "HAEDAL" | "JPY" | "TAO" | "VIRTUAL" | "TIA" | "TRX" | "FRAG" | "PUMP" | "WCT" | "ES" | "SEI" | "CRV" | "TON" | "HBAR" | "XLM" | "ZORA" | "WLFI" | "BPEUR" | "SWTCH" | "LINEA" | "XPL" | "BARD" | "FLOCK" | "AVNT" | "PENDLE" | "AERO" | "ASTER" | "GLXY" | "0G" | "2Z";
export type BackpackBatchCommandOrderResult = BackpackBatchCommandOrderResult_OrderType | BackpackBatchCommandOrderResult_ApiErrorResponse;
export type BackpackBatchCommandOrderResult_ApiErrorResponse = {
  operation: "Err";
} & BackpackApiErrorResponse;
export type BackpackBatchCommandOrderResult_OrderType = {
  operation: "Ok";
} & BackpackOrderType;
export type BackpackBlockchain = "0G" | "Aptos" | "Arbitrum" | "Avalanche" | "Base" | "Berachain" | "Bitcoin" | "BitcoinCash" | "Bsc" | "Cardano" | "Dogecoin" | "Eclipse" | "EqualsMoney" | "Ethereum" | "HyperEVM" | "Hyperliquid" | "Linea" | "Litecoin" | "Optimism" | "Plasma" | "Polygon" | "Sei" | "Sui" | "Solana" | "Story" | "Tron" | "XRP";
export type BackpackBorrowLendBookState = "Open" | "Closed" | "RepayOnly";
export type BackpackBorrowLendEventType = "Borrow" | "BorrowRepay" | "Lend" | "LendRedeem";
export interface BackpackBorrowLendExecutePayload {
  quantity: string;
  side: BackpackBorrowLendSide;
  symbol: BackpackAsset;
}
export interface BackpackBorrowLendHistory {
  borrowInterestRate: string;
  borrowedQuantity: string;
  lendInterestRate: string;
  lentQuantity: string;
  timestamp: string;
  utilization: string;
}
export interface BackpackBorrowLendMarket {
  state: BackpackBorrowLendBookState;
  assetMarkPrice: string;
  borrowInterestRate: string;
  borrowedQuantity: string;
  fee: string;
  lendInterestRate: string;
  lentQuantity: string;
  maxUtilization: string;
  openBorrowLendLimit: string;
  optimalUtilization: string;
  symbol: BackpackAsset;
  timestamp: string;
  throttleUtilizationThreshold: string;
  throttleUtilizationBound: string;
  throttleUpdateFraction: string;
  utilization: string;
  stepSize: string;
}
export type BackpackBorrowLendMarketHistoryInterval = "1d" | "1w" | "1month" | "1year";
export interface BackpackBorrowLendMovement {
  eventType: BackpackBorrowLendEventType;
  positionId: string;
  positionQuantity?: string;
  quantity: string;
  source: BackpackBorrowLendSource;
  symbol: string;
  timestamp: string;
  spotMarginOrderId?: string;
}
export interface BackpackBorrowLendPositionRow {
  positionId: string;
  quantity: string;
  symbol: string;
  source: BackpackBorrowLendSource;
  cumulativeInterest: string;
  avgInterestRate: string;
  side: BackpackBorrowLendSide;
  createdAt: string;
}
export type BackpackBorrowLendPositionState = "Open" | "Closed";
export interface BackpackBorrowLendPositionWithMargin {
  cumulativeInterest: string;
  id: string;
  imf: string;
  imfFunction: BackpackPositionImfFunction;
  netQuantity: string;
  markPrice: string;
  mmf: string;
  mmfFunction: BackpackPositionImfFunction;
  netExposureQuantity: string;
  netExposureNotional: string;
  symbol: BackpackAsset;
}
export type BackpackBorrowLendSide = "Borrow" | "Lend";
export type BackpackBorrowLendSource = "AdlProvider" | "AutoBorrowRepay" | "AutoLend" | "BackstopProvider" | "DustConversion" | "Interest" | "Liquidation" | "LiquidationAdl" | "LiquidationBackstop" | "Manual" | "Reconciliation" | "SpotMargin" | "Withdrawal";
export type BackpackCancelOrderTypeEnum = "RestingLimitOrder" | "ConditionalOrder";
export interface BackpackCollateral {
  symbol: string;
  assetMarkPrice: string;
  totalQuantity: string;
  balanceNotional: string;
  collateralWeight: string;
  collateralValue: string;
  openOrderQuantity: string;
  lendQuantity: string;
  availableQuantity: string;
}
export interface BackpackCollateralFunction {
  weight: string;
  kind: BackpackCollateralFunctionKind;
}
export type BackpackCollateralFunctionKind = BackpackCollateralFunctionKind_IdentityFunction | BackpackCollateralFunctionKind_InverseSqrtFunction;
export type BackpackCollateralFunctionKind_IdentityFunction = {
  type: "identity";
} & BackpackIdentityFunction;
export type BackpackCollateralFunctionKind_InverseSqrtFunction = {
  type: "inverseSqrt";
} & BackpackInverseSqrtFunction;
export interface BackpackCollateralSummary {
  symbol: string;
  imfFunction: BackpackPositionImfFunction;
  mmfFunction: BackpackPositionImfFunction;
  haircutFunction: BackpackCollateralFunction;
}
export interface BackpackCreateWithdrawalDelayRequest {
  withdrawalDelayHours: number;
  twoFactorToken: string;
}
export interface BackpackDeposit {
  id: number;
  toAddress?: string;
  fromAddress?: string;
  source: BackpackDepositSource;
  status: BackpackDepositStatus;
  transactionHash?: string;
  symbol: BackpackAsset;
  quantity: string;
  createdAt: string;
  fiatAmount?: number;
  fiatCurrency?: BackpackFiatAsset;
  institutionBic?: string;
  platformMemo?: string;
}
export interface BackpackDepositAddress {
  address: string;
}
export type BackpackDepositSource = "administrator" | "0G" | "aptos" | "arbitrum" | "avalanche" | "base" | "berachain" | "bitcoin" | "bitcoinCash" | "bsc" | "cardano" | "dogecoin" | "eclipse" | "ethereum" | "hyperEVM" | "hyperliquid" | "linea" | "litecoin" | "polygon" | "optimism" | "plasma" | "sei" | "sui" | "solana" | "story" | "tron" | "xRP" | "equalsMoney" | "banxa" | "internal";
export type BackpackDepositStatus = "cancelled" | "confirmed" | "declined" | "expired" | "initiated" | "ownershipVerificationRequired" | "pending" | "refunded" | "senderVerificationCompleted" | "senderVerificationRequired";
export interface BackpackDepth {
  asks: string[][];
  bids: string[][];
  lastUpdateId: string;
  timestamp: number;
}
export interface BackpackDustConversion {
  id: number;
  quantity: string;
  symbol: string;
  usdcReceived: string;
  timestamp: string;
}
export type BackpackEqualsMoneyWithdrawalState = "initialized" | "pending" | "fulfilling" | "processing" | "complete" | "declined" | "cancelled" | "review" | "awaitingDocuments" | "awaitingComplianceQuestions" | "refundedInternal" | "refundedExternal";
export type BackpackFiatAsset = "AED" | "AUD" | "BGN" | "BHD" | "CAD" | "CHF" | "CNH" | "CNY" | "CZK" | "DKK" | "EUR" | "GBP" | "HKD" | "HUF" | "ILS" | "JOD" | "JPY" | "KES" | "KWD" | "MUR" | "MXN" | "NOK" | "NZD" | "OMR" | "PLN" | "QAR" | "RON" | "SAR" | "SEK" | "SGD" | "THB" | "TND" | "TRY" | "USD" | "ZAR" | "ZMW";
export type BackpackFillType = "User" | "BookLiquidation" | "Adl" | "Backstop" | "Liquidation" | "AllLiquidation" | "CollateralConversion" | "CollateralConversionAndSpotLiquidation";
export interface BackpackFundingIntervalRate {
  symbol: string;
  intervalEndTimestamp: string;
  fundingRate: string;
}
export interface BackpackFundingPayment {
  userId: number;
  subaccountId?: number;
  symbol: string;
  quantity: string;
  intervalEndTimestamp: string;
  fundingRate: string;
}
export interface BackpackFuturePositionWithMargin {
  breakEvenPrice: string;
  entryPrice: string;
  estLiquidationPrice: string;
  imf: string;
  imfFunction: BackpackPositionImfFunction;
  markPrice: string;
  mmf: string;
  mmfFunction: BackpackPositionImfFunction;
  netCost: string;
  netQuantity: string;
  netExposureQuantity: string;
  netExposureNotional: string;
  pnlRealized: string;
  pnlUnrealized: string;
  cumulativeFundingPayment: string;
  subaccountId?: number;
  symbol: string;
  userId: number;
  positionId: string;
  cumulativeInterest: string;
}
export type BackpackIdentityFunction = Record<string, unknown>;
export interface BackpackInterestPayment {
  paymentType: BackpackPaymentType;
  interestRate: string;
  interval: number;
  marketSymbol: string;
  positionId: string;
  quantity: string;
  symbol: BackpackAsset;
  timestamp: string;
}
export type BackpackInterestPaymentSource = "UnrealizedPnl" | "BorrowLend";
export interface BackpackInverseSqrtFunction {
  base: string;
  positiveCurvePenalty: string;
}
export interface BackpackKline {
  start: string;
  end: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume: string;
  quoteVolume: string;
  trades: string;
}
export type BackpackKlineInterval = "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "8h" | "12h" | "1d" | "3d" | "1w" | "1month";
export type BackpackKlinePriceType = "Last" | "Index" | "Mark";
export interface BackpackLimitOrder {
  id: string;
  clientId?: number;
  createdAt: number;
  executedQuantity: string;
  executedQuoteQuantity: string;
  postOnly: boolean;
  price: string;
  quantity: string;
  reduceOnly?: boolean;
  selfTradePrevention: BackpackSelfTradePrevention;
  status: BackpackOrderStatus;
  stopLossTriggerPrice?: string;
  stopLossLimitPrice?: string;
  stopLossTriggerBy?: string;
  side: BackpackSide;
  symbol: string;
  takeProfitTriggerPrice?: string;
  takeProfitLimitPrice?: string;
  takeProfitTriggerBy?: string;
  timeInForce: BackpackTimeInForce;
  triggerBy?: string;
  triggerPrice?: string;
  triggerQuantity?: string;
  triggeredAt?: number;
  relatedOrderId?: string;
  strategyId?: string;
}
export interface BackpackMarginAccountSummary {
  assetsValue: string;
  borrowLiability: string;
  collateral: BackpackCollateral[];
  imf: string;
  unsettledEquity: string;
  liabilitiesValue: string;
  marginFraction?: string;
  mmf: string;
  netEquity: string;
  netEquityAvailable: string;
  netEquityLocked: string;
  netExposureFutures: string;
  pnlUnrealized: string;
}
export interface BackpackMarkPrice {
  fundingRate: string;
  indexPrice: string;
  markPrice: string;
  nextFundingTimestamp: number;
  symbol: string;
}
export interface BackpackMarket {
  symbol: string;
  baseSymbol: BackpackAsset;
  quoteSymbol: BackpackAsset;
  marketType: BackpackMarketType;
  filters: BackpackOrderBookFilters;
  imfFunction?: BackpackPositionImfFunction;
  mmfFunction?: BackpackPositionImfFunction;
  fundingInterval?: number;
  fundingRateUpperBound?: string;
  fundingRateLowerBound?: string;
  openInterestLimit?: string;
  orderBookState: BackpackOrderBookState;
  createdAt: string;
  visible: boolean;
}
export interface BackpackMarketAsset {
  symbol: BackpackAsset;
  displayName: string;
  coingeckoId?: string;
  tokens: BackpackToken[];
}
export interface BackpackMarketOrder {
  id: string;
  clientId?: number;
  createdAt: number;
  executedQuantity: string;
  executedQuoteQuantity: string;
  quantity?: string;
  quoteQuantity?: string;
  reduceOnly?: boolean;
  timeInForce: BackpackTimeInForce;
  selfTradePrevention: BackpackSelfTradePrevention;
  side: BackpackSide;
  status: BackpackOrderStatus;
  stopLossTriggerPrice?: string;
  stopLossLimitPrice?: string;
  stopLossTriggerBy?: string;
  symbol: string;
  takeProfitTriggerPrice?: string;
  takeProfitLimitPrice?: string;
  takeProfitTriggerBy?: string;
  triggerBy?: string;
  triggerPrice?: string;
  triggerQuantity?: string;
  triggeredAt?: number;
  relatedOrderId?: string;
  strategyId?: string;
  slippageTolerance?: string;
  slippageToleranceType?: BackpackSlippageToleranceType;
}
export type BackpackMarketType = "SPOT" | "PERP" | "IPERP" | "DATED" | "PREDICTION" | "RFQ";
export interface BackpackMaxBorrowQuantity {
  maxBorrowQuantity: string;
  symbol: string;
}
export interface BackpackMaxOrderQuantity {
  autoBorrow?: boolean;
  autoBorrowRepay?: boolean;
  autoLendRedeem?: boolean;
  maxOrderQuantity: string;
  price?: string;
  side: string;
  symbol: string;
  reduceOnly?: boolean;
}
export interface BackpackMaxWithdrawalQuantity {
  autoBorrow?: boolean;
  autoLendRedeem?: boolean;
  maxWithdrawalQuantity: string;
  symbol: string;
}
export interface BackpackOpenInterest {
  symbol: string;
  openInterest?: string;
  timestamp: number;
}
export interface BackpackOrder {
  id: string;
  createdAt: string;
  executedQuantity?: string;
  executedQuoteQuantity?: string;
  expiryReason?: BackpackOrderExpiryReason;
  orderType: BackpackOrderTypeEnum;
  postOnly?: boolean;
  price?: string;
  quantity?: string;
  quoteQuantity?: string;
  selfTradePrevention: BackpackSelfTradePrevention;
  status: BackpackOrderStatus;
  side: BackpackSide;
  stopLossTriggerPrice?: string;
  stopLossLimitPrice?: string;
  stopLossTriggerBy?: string;
  symbol: string;
  takeProfitTriggerPrice?: string;
  takeProfitLimitPrice?: string;
  takeProfitTriggerBy?: string;
  timeInForce: BackpackTimeInForce;
  triggerBy?: string;
  triggerPrice?: string;
  triggerQuantity?: string;
  clientId?: number;
  systemOrderType?: BackpackSystemOrderType;
  strategyId?: string;
  slippageTolerance?: string;
  slippageToleranceType?: BackpackSlippageToleranceType;
}
export interface BackpackOrderBookFilters {
  price: BackpackPriceFilter;
  quantity: BackpackQuantityFilter;
}
export type BackpackOrderBookState = "Open" | "Closed" | "CancelOnly" | "LimitOnly" | "PostOnly";
export interface BackpackOrderCancelAllPayload {
  symbol: string;
  orderType?: BackpackCancelOrderTypeEnum;
}
export interface BackpackOrderCancelPayload {
  clientId?: number;
  orderId?: string;
  symbol: string;
}
export interface BackpackOrderExecutePayload {
  autoLend?: boolean;
  autoLendRedeem?: boolean;
  autoBorrow?: boolean;
  autoBorrowRepay?: boolean;
  brokerId?: number;
  clientId?: number;
  orderType: BackpackOrderTypeEnum;
  postOnly?: boolean;
  price?: string;
  quantity?: string;
  quoteQuantity?: string;
  reduceOnly?: boolean;
  selfTradePrevention?: BackpackSelfTradePrevention;
  side: BackpackSide;
  stopLossLimitPrice?: string;
  stopLossTriggerBy?: string;
  stopLossTriggerPrice?: string;
  symbol: string;
  takeProfitLimitPrice?: string;
  takeProfitTriggerBy?: string;
  takeProfitTriggerPrice?: string;
  timeInForce?: BackpackTimeInForce;
  triggerBy?: string;
  triggerPrice?: string;
  triggerQuantity?: string;
  slippageTolerance?: string;
  slippageToleranceType?: BackpackSlippageToleranceType;
}
export type BackpackOrderExpiryReason = "AccountTradingSuspended" | "BorrowRequiresLendRedeem" | "FillOrKill" | "InsufficientBorrowableQuantity" | "InsufficientFunds" | "InsufficientLiquidity" | "InvalidPrice" | "InvalidQuantity" | "ImmediateOrCancel" | "InsufficientMargin" | "Liquidation" | "NegativeEquity" | "PostOnlyMode" | "PostOnlyTaker" | "PriceOutOfBounds" | "ReduceOnlyNotReduced" | "SelfTradePrevention" | "StopWithoutPosition" | "PriceImpact" | "Unknown" | "UserPermissions" | "MaxStopOrdersPerPosition" | "PositionLimit" | "SlippageToleranceExceeded";
export interface BackpackOrderFill {
  clientId?: string;
  fee: string;
  feeSymbol: string;
  isMaker: boolean;
  orderId: string;
  price: string;
  quantity: string;
  side: BackpackSide;
  symbol: string;
  systemOrderType?: BackpackSystemOrderType;
  timestamp: string;
  tradeId?: number;
}
export type BackpackOrderStatus = "Cancelled" | "Expired" | "Filled" | "New" | "PartiallyFilled" | "TriggerPending" | "TriggerFailed";
export type BackpackOrderType = BackpackOrderType_MarketOrder | BackpackOrderType_LimitOrder;
export type BackpackOrderTypeEnum = "Market" | "Limit";
export type BackpackOrderType_LimitOrder = {
  orderType: "Limit";
} & BackpackLimitOrder;
export type BackpackOrderType_MarketOrder = {
  orderType: "Market";
} & BackpackMarketOrder;
export type BackpackPaymentType = "EntryFee" | "Borrow" | "Lend" | "UnrealizedPositivePnl" | "UnrealizedNegativePnl";
export interface BackpackPositionEstimatedLiquidationPrice {
  liquidationPrice: string;
  markPrice: string;
}
export type BackpackPositionImfFunction = BackpackPositionImfFunction_SqrtFunction;
export type BackpackPositionImfFunction_SqrtFunction = {
  type: "sqrt";
} & BackpackSqrtFunction;
export interface BackpackPriceBandMarkPrice {
  maxMultiplier: string;
  minMultiplier: string;
}
export interface BackpackPriceBandMeanPremium {
  tolerancePct: string;
}
export interface BackpackPriceFilter {
  minPrice: string;
  maxPrice?: string;
  tickSize: string;
  maxMultiplier?: string;
  minMultiplier?: string;
  maxImpactMultiplier?: string;
  minImpactMultiplier?: string;
  meanMarkPriceBand?: BackpackPriceBandMarkPrice;
  meanPremiumBand?: BackpackPriceBandMeanPremium;
  borrowEntryFeeMaxMultiplier?: string;
  borrowEntryFeeMinMultiplier?: string;
}
export interface BackpackQuantityFilter {
  minQuantity: string;
  maxQuantity?: string;
  stepSize: string;
}
export interface BackpackQuote {
  rfqId: string;
  quoteId: string;
  clientId?: number;
  bidPrice: string;
  askPrice: string;
  status: BackpackOrderStatus;
  createdAt: number;
}
export interface BackpackQuoteAcceptPayload {
  rfqId?: string;
  clientId?: number;
  quoteId: string;
}
export interface BackpackQuoteHistorical {
  userId: number;
  subaccountId?: number;
  rfqId: string;
  quoteId: string;
  clientId?: number;
  bidPrice: string;
  askPrice: string;
  status: BackpackOrderStatus;
  createdAt: string;
}
export interface BackpackQuotePayload {
  rfqId: string;
  clientId?: number;
  bidPrice: string;
  askPrice: string;
}
export interface BackpackRequestForQuote {
  rfqId: string;
  clientId?: number;
  symbol: string;
  side: BackpackSide;
  price?: string;
  quantity?: string;
  quoteQuantity?: string;
  submissionTime: number;
  systemOrderType?: BackpackSystemOrderType;
  expiryTime: number;
  status: BackpackOrderStatus;
  executionMode: BackpackRfqExecutionMode;
  createdAt: number;
}
export interface BackpackRequestForQuoteCancelPayload {
  rfqId?: string;
  clientId?: number;
}
export interface BackpackRequestForQuoteHistorical {
  userId: number;
  subaccountId?: number;
  rfqId: string;
  clientId?: number;
  symbol: string;
  side: BackpackSide;
  price?: string;
  quantity?: string;
  quoteQuantity?: string;
  submissionTime: string;
  expiryTime: string;
  status: BackpackOrderStatus;
  executionMode: BackpackRfqExecutionMode;
  createdAt: string;
}
export interface BackpackRequestForQuotePayload {
  clientId?: number;
  quantity?: string;
  quoteQuantity?: string;
  price?: string;
  symbol: string;
  side: BackpackSide;
  executionMode?: BackpackRfqExecutionMode;
}
export interface BackpackRequestForQuoteRefreshPayload {
  rfqId: string;
}
export type BackpackRfqExecutionMode = "AwaitAccept" | "Immediate";
export interface BackpackScheduledStrategy {
  id: string;
  clientStrategyId?: number;
  createdAt: number;
  executedQuantity: string;
  executedQuoteQuantity: string;
  quantity: string;
  reduceOnly?: boolean;
  selfTradePrevention: BackpackSelfTradePrevention;
  status: BackpackStrategyStatus;
  side: BackpackSide;
  symbol: string;
  timeInForce: BackpackTimeInForce;
  duration: number;
  interval: number;
  randomizedIntervalQuantity?: boolean;
  slippageTolerance?: string;
  slippageToleranceType?: BackpackSlippageToleranceType;
}
export type BackpackSelfTradePrevention = "RejectTaker" | "RejectMaker" | "RejectBoth";
export interface BackpackSettlement {
  quantity: string;
  source: BackpackSettlementSource;
  subaccountId?: number;
  timestamp: string;
  userId: number;
}
export type BackpackSettlementSource = "TradingFees" | "TradingFeesSystem" | "FundingPayment" | "CulledBorrowInterest" | "CulledRealizePnlAuto" | "CulledRealizePnlBookUtilisation" | "CulledRealizePnlAccountThreshold" | "CulledRealizePnlSystemThreshold" | "RealizePnl" | "BackstopProviderLiquidation" | "BackstopAdlLiquidation" | "BackstopLiquidityFundProceeds";
export type BackpackSettlementSourceFilter = "BackstopLiquidation" | "CulledBorrowInterest" | "CulledRealizePnl" | "CulledRealizePnlBookUtilization" | "FundingPayment" | "RealizePnl" | "TradingFees" | "TradingFeesSystem";
export type BackpackSide = "Bid" | "Ask";
export type BackpackSlippageToleranceType = "TickSize" | "Percent";
export type BackpackSortDirection = "Asc" | "Desc";
export interface BackpackSqrtFunction {
  base: string;
  factor: string;
}
export type BackpackStatus = "Ok" | "Maintenance";
export interface BackpackStatusAndMessage {
  status: BackpackStatus;
  message?: string;
}
export interface BackpackStrategy {
  id: string;
  createdAt: string;
  executedQuantity?: string;
  executedQuoteQuantity?: string;
  cancelReason?: BackpackStrategyCrankCancelReason;
  strategyType: BackpackStrategyTypeEnum;
  quantity?: string;
  selfTradePrevention: BackpackSelfTradePrevention;
  status: BackpackStrategyStatus;
  side: BackpackSide;
  symbol: string;
  timeInForce: BackpackTimeInForce;
  clientStrategyId?: number;
  duration: number;
  interval: number;
  randomizedIntervalQuantity: boolean;
  slippageTolerance?: string;
  slippageToleranceType?: BackpackSlippageToleranceType;
}
export interface BackpackStrategyCancelAllPayload {
  symbol: string;
  strategyType?: BackpackStrategyTypeEnum;
}
export interface BackpackStrategyCancelPayload {
  clientStrategyId?: number;
  strategyId?: string;
  symbol: string;
}
export type BackpackStrategyCrankCancelReason = "Expired" | "FillOrKill" | "InsufficientBorrowableQuantity" | "InsufficientFunds" | "InsufficientLiquidity" | "InvalidPrice" | "InvalidQuantity" | "InsufficientMargin" | "Liquidation" | "PriceOutOfBounds" | "ReduceOnlyNotReduced" | "SelfTradePrevention" | "Unknown" | "UserPermissions";
export interface BackpackStrategyCreatePayload {
  autoLend?: boolean;
  autoLendRedeem?: boolean;
  autoBorrow?: boolean;
  autoBorrowRepay?: boolean;
  brokerId?: number;
  clientStrategyId?: number;
  strategyType: BackpackStrategyTypeEnum;
  quantity?: string;
  price?: string;
  postOnly?: boolean;
  reduceOnly?: boolean;
  selfTradePrevention?: BackpackSelfTradePrevention;
  side: BackpackSide;
  symbol: string;
  timeInForce?: BackpackTimeInForce;
  duration?: number;
  interval?: number;
  randomizedIntervalQuantity?: boolean;
  slippageTolerance?: string;
  slippageToleranceType?: BackpackSlippageToleranceType;
}
export type BackpackStrategyStatus = "Running" | "Completed" | "Cancelled" | "Terminated";
export type BackpackStrategyType = BackpackStrategyType_ScheduledStrategy;
export type BackpackStrategyTypeEnum = "Scheduled";
export type BackpackStrategyType_ScheduledStrategy = {
  strategyType: "Scheduled";
} & BackpackScheduledStrategy;
export type BackpackSystemOrderType = "CollateralConversion" | "FutureExpiry" | "LiquidatePositionOnAdl" | "LiquidatePositionOnBook" | "LiquidatePositionOnBackstop" | "OrderBookClosed";
export interface BackpackTicker {
  symbol: string;
  firstPrice: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  high: string;
  low: string;
  volume: string;
  quoteVolume: string;
  trades: string;
}
export type BackpackTickerInterval = "1d" | "1w";
export type BackpackTimeInForce = "GTC" | "IOC" | "FOK";
export interface BackpackToken {
  displayName: string;
  blockchain: BackpackBlockchain;
  contractAddress?: string;
  depositEnabled: boolean;
  minimumDeposit: string;
  withdrawEnabled: boolean;
  minimumWithdrawal: string;
  maximumWithdrawal?: string;
  withdrawalFee: string;
}
export interface BackpackTrade {
  id?: number;
  price: string;
  quantity: string;
  quoteQuantity: string;
  timestamp: number;
  isBuyerMaker: boolean;
}
export interface BackpackUpdateAccountSettingsRequest {
  autoBorrowSettlements?: boolean;
  autoLend?: boolean;
  autoRepayBorrows?: boolean;
  leverageLimit?: string;
}
export interface BackpackUpdateWithdrawalDelayRequest {
  withdrawalDelayHours: number;
  twoFactorToken: string;
}
export interface BackpackWalletResponse {
  blockchain: string;
  address: string;
}
export interface BackpackWithdrawal {
  id: number;
  blockchain: BackpackBlockchain;
  clientId?: string;
  identifier?: string;
  quantity: string;
  fee: string;
  fiatFee?: string;
  fiatState?: BackpackEqualsMoneyWithdrawalState;
  fiatSymbol?: BackpackFiatAsset;
  providerId?: string;
  symbol: BackpackAsset;
  status: BackpackWithdrawalStatus;
  subaccountId?: number;
  toAddress: string;
  transactionHash?: string;
  createdAt: string;
  isInternal: boolean;
  bankName?: string;
  bankIdentifier?: string;
  accountIdentifier?: string;
  triggerAt?: string;
}
export interface BackpackWithdrawalDelay {
  currentWithdrawalDelayHours?: number;
  pendingWithdrawalDelayHours?: number;
  pendingWithdrawalDelayHoursEnabledAt?: string;
}
export type BackpackWithdrawalStatus = "confirmed" | "ownershipVerificationRequired" | "pending" | "recipientInformationProvided" | "recipientInformationRequired";
