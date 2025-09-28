import { BigNumber } from "bignumber.js";
import { ExchangeAdapter } from "../exchanges/exchange.adapter.js";
import { ArbitrageBase } from "./base.js";
import { TRiskDataInfo } from "./type.js";
import { blogger } from "../common/base/logger.js";
import { TExchangeTokenInfo, TokenInfoService } from "../service/tokenInfo.service.js";
import { TSMap } from "../libs/tsmap.js";

const DEFAULT_LEVERAGE = 5

/**
 * 调整各交易所币对杠杆
 * 调整到默认杠杆
 */
export class LeverageMgr extends ArbitrageBase {
  private exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>

  constructor(traceId: string, exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>) {
    super(traceId)
    this.exchangeTokenInfoMap = exchangeTokenInfoMap
  }

  async run(exchangeList: ExchangeAdapter[], riskData: TRiskDataInfo) {
    const { chainTokenPositionMap } = riskData
    const chainTokenList = chainTokenPositionMap.keys()
    for (const chainToken of chainTokenList) {
      const chainTokenPosition = chainTokenPositionMap.get(chainToken)
      if (!chainTokenPosition) {
        continue
      }
      const positions = chainTokenPosition.positions
      for (let i = 0; i < positions.length; i++) {
        const position = positions[i]
        if (!position) {
          continue
        }
        const leverage = position.leverage
        if (!BigNumber(position.leverage).eq(DEFAULT_LEVERAGE)) {
          const exchange = exchangeList[i]
          const key = TokenInfoService.getExchangeTokenKey(exchange.exchangeName, chainToken)
          const exchangeInfo = this.exchangeTokenInfoMap.get(key)
          if (!exchangeInfo) {
            blogger.error(`${this.traceId} chainToken: ${chainToken} not found in exchangeTokenInfoMap, key: ${key}`)
            continue
          }
          const symbol = exchange.generateExchangeSymbol(exchangeInfo.exchangeTokenInfo.exchangeToken)
          blogger.info(`${this.traceId} set leverage, exchange: ${exchange.exchangeName}, symbol: ${symbol}, leverage: ${leverage} -> ${DEFAULT_LEVERAGE}`)
          await exchange.ensureLeverage(symbol, DEFAULT_LEVERAGE)
        }
      }
    }
  }
}
