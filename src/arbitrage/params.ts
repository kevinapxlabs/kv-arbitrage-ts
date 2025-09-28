export class ParamsMgr {
  static USD_AMOUNT_EVERY_ORDER = BigNumber(200)           // 每次下单的金额 USD

  static stableTokenList = [ 'USDT', 'USDC' ]

  // tg 通知
  static TgNoticeName = 'arbitrage'            // 普通信息通知，如资定时任务数据
  static MINUTES_INTERVAL = 20                  // 通知间隔时间，分钟
}