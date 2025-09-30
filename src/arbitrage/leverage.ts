import BigNumber from "bignumber.js";
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
  private readonly exchangeTokenInfoLookup: Map<string, TExchangeTokenInfo>

  constructor(traceId: string, exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>) {
    super(traceId)
    this.exchangeTokenInfoLookup = new Map<string, TExchangeTokenInfo>()

    // 展平 TSMap 到原生 Map 方便快速检索
    exchangeTokenInfoMap.forEach((exchangeTokenInfo, key) => {
      if (typeof key === 'string') {
        this.exchangeTokenInfoLookup.set(key, exchangeTokenInfo)
      }
    })
  }

  async run(exchangeList: ExchangeAdapter[], riskData: TRiskDataInfo) {
    const { chainTokenPositionMap } = riskData
    const chainTokens = chainTokenPositionMap.keys()
    const chainTokenPositions = chainTokenPositionMap.values()
    // 预构建交易所名称索引，避免通过数组下标关联
    const exchangeByName = new Map(exchangeList.map(exchange => [exchange.exchangeName, exchange]))

    for (let index = 0; index < chainTokens.length; index++) {
      const chainToken = chainTokens[index]
      const chainTokenPosition = chainTokenPositions[index]
      if (!chainToken || !chainTokenPosition) {
        continue
      }

      for (const position of chainTokenPosition.positions) {
        if (!position) {
          continue
        }

        if (new BigNumber(position.leverage).eq(DEFAULT_LEVERAGE)) {
          continue
        }

        const exchange = exchangeByName.get(position.exchangeName)
        if (!exchange) {
          blogger.error(`${this.traceId} exchange: ${position.exchangeName} not found while setting leverage for ${chainToken}`)
          continue
        }

        const key = TokenInfoService.getExchangeTokenKey(exchange.exchangeName, chainToken)
        const exchangeInfo = this.exchangeTokenInfoLookup.get(key)
        if (!exchangeInfo) {
          blogger.error(`${this.traceId} chainToken: ${chainToken} not found in exchangeTokenInfoMap, key: ${key}`)
          continue
        }

        const symbol = exchange.generateExchangeSymbol(exchangeInfo.exchangeTokenInfo.exchangeToken)
        blogger.info(`${this.traceId} set leverage, exchange: ${exchange.exchangeName}, symbol: ${symbol}, leverage: ${position.leverage} -> ${DEFAULT_LEVERAGE}`)
        await exchange.ensureLeverage(symbol, DEFAULT_LEVERAGE)
      }
    }
  }
}
