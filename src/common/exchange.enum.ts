export enum EExchange {
  Aster = 'ASTER',
  Backpack = 'BACKPACK',
}

// 交易所下单方向
export enum EKVSide {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

export enum EExchangeCexId {
  Binance = 1,
  Bybit = 2,
  OKX = 3,
  Gate = 4,
  BackPack = 5,
  Bitget = 6,
  Aster = 7,
}

export enum EExchangeId {
  Bybit = 20,
  Bitget = 21,
  Binance = 22,
  LtpBinance = 23,
  LtpOkx = 24,
  BackPack = 25,
  Aster = 27
}

// 系统下单原因
export enum EOrderReason {
  DEFAULT = 0,
  PROFIT_LOCKED = 1,
  POSITION_ADJUSTMENT = 2,
  DECREASE_POSITION = 3,
  REDUCE_POSITION = 4,
  REBALANCE = 5,
}
