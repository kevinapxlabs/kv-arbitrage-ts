export enum AsterOrderSide {
  BUY = 'BUY',
  SELL = 'SELL'
}

export enum AsterOrderType {
  LIMIT = 'LIMIT',
  MARKET = 'MARKET',
  STOP = 'STOP',
  STOP_MARKET = 'STOP_MARKET',
  TAKE_PROFIT = 'TAKE_PROFIT',
  TAKE_PROFIT_MARKET = 'TAKE_PROFIT_MARKET',
  TRAILING_STOP_MARKET = 'TRAILING_STOP_MARKET'
}

export enum AsterTimeInForce {
  GTC = 'GTC',
  IOC = 'IOC',
  FOK = 'FOK',
  GTX = 'GTX',
  HIDDEN = 'HIDDEN'
}

export enum AsterWorkingType {
  MARK_PRICE = 'MARK_PRICE',
  CONTRACT_PRICE = 'CONTRACT_PRICE'
}

export enum AsterOrderStatus {
  NEW = 'NEW',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  FILLED = 'FILLED',
  CANCELED = 'CANCELED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED'
}

export enum AsterPositionSide {
  BOTH = 'BOTH',
  LONG = 'LONG',
  SHORT = 'SHORT'
}

export enum AsterContractType {
  PERPETUAL = 'PERPETUAL'
}

export enum AsterContractStatus {
  PENDING_TRADING = 'PENDING_TRADING',
  TRADING = 'TRADING',
  PRE_SETTLE = 'PRE_SETTLE',
  SETTLING = 'SETTLING',
  CLOSE = 'CLOSE'
}

export enum AsterMarginType {
  ISOLATED = 'ISOLATED',
  CROSSED = 'CROSSED'
}

export enum AsterIncomeType {
  TRANSFER = 'TRANSFER',
  WELCOME_BONUS = 'WELCOME_BONUS',
  REALIZED_PNL = 'REALIZED_PNL',
  FUNDING_FEE = 'FUNDING_FEE',
  COMMISSION = 'COMMISSION',
  INSURANCE_CLEAR = 'INSURANCE_CLEAR',
  MARKET_MERCHANT_RETURN_REWARD = 'MARKET_MERCHANT_RETURN_REWARD'
}

export enum AsterNewOrderRespType {
  ACK = 'ACK',
  RESULT = 'RESULT'
}

export enum AsterMarginChangeType {
  INCREASE = 1,
  DECREASE = 2
}
