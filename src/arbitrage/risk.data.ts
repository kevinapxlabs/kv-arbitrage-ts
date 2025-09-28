import { BigNumber } from "bignumber.js";
import { TSMap } from "../libs/tsmap.js";
import { TAccountInfo, TKVPosition } from "../exchanges/types.js";
import { ArbitrageBase } from "./base.js";
import { TExchangeRiskInfo, TRiskDataInfo, TTokenNotional, TTokenPosition } from "./type.js";
import { ExchangeDataMgr } from "./exchange.data.js";
import { blogger } from "../common/base/logger.js";
import { ExchangeIndexMgr } from "./exchange.index.js";
import { TExchangeTokenInfo, TokenInfoService } from "../service/tokenInfo.service.js";

export class RiskDataMgr extends ArbitrageBase {
  private exchangeIndexMgr: ExchangeIndexMgr
  private exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>

  constructor(
    traceId: string,
    exchangeIndexMgr: ExchangeIndexMgr,
    exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  ) {
    super(traceId)
    this.exchangeIndexMgr = exchangeIndexMgr
    this.exchangeTokenInfoMap = exchangeTokenInfoMap
  }

  tokenNotionalInit(chainToken: string): TTokenNotional {
    return {
      chainToken,
      positionAmt: '0',
      positiveNotional: '0',
      negativeNotional: '0'
    }
  }

  /*
  * 获取币种的多单持仓价值并返回
  * 更新各交易所的持仓价值
  * @param chainToken 
  * @param positions 
  * @returns [{
  *   chainToken: string,       // 币种名称
  *   positionAmt: string,      // 持仓数量
  *   positiveNotional: string, // 正向持仓价值, 值为正数
  *   negativeNotional: string  // 负向持仓价值, 值为正数
  * }] 按交易所顺序返回
  */
  async getTokenNotional(chainToken: string, positions: (TKVPosition | null)[]): Promise<TTokenNotional[]> {
    const tokenNotionalList: TTokenNotional[] = Array.from({ length: this.exchangeIndexMgr.exchangeList.length }, () => this.tokenNotionalInit(chainToken))
    // 获取chainToken的indexPrice
    const exchangeDataMgr = new ExchangeDataMgr(this.traceId)
    const indexPrice = await exchangeDataMgr.getIndexPrice2(this.exchangeIndexMgr.exchangeList, chainToken, this.exchangeTokenInfoMap)
    if (!indexPrice) {
      return tokenNotionalList
    }
    for (let i = 0; i < positions.length; i++) {
      const position = positions[i]
      if (position) {
        const notional = indexPrice.multipliedBy(position.positionAmt);
        // 更新position的持仓价值
        const positiveNotional = notional.abs().toFixed(2)
        position.notional = positiveNotional;
        // 更新tokenNotionalList的持仓数量
        tokenNotionalList[i].positionAmt = position.positionAmt
        // 更新tokenNotionalList的持仓价值，区分正负仓位
        if (BigNumber(position.positionAmt).gt(0)) {
          tokenNotionalList[i].positiveNotional = positiveNotional
        } else {
          tokenNotionalList[i].negativeNotional = positiveNotional
        }
      }
    }
    return tokenNotionalList
  }

  async getRiskData(): Promise<TRiskDataInfo> {
    let totalNetEquity = BigNumber(0)
    let accountInfo: TAccountInfo = {
      totalNetEquity: '0',
      totalPositiveNotional: '0',
      bpAccountInfo: null,
      asterAccountInfo: null
    }
    for (const exchange of this.exchangeIndexMgr.exchangeList) {
      const exchangeAccountInfo = await exchange.getAccountInfo()
      if (exchangeAccountInfo.bpAccountInfo) {
        totalNetEquity = totalNetEquity.plus(BigNumber(exchangeAccountInfo.bpAccountInfo.equity))
        accountInfo.bpAccountInfo = exchangeAccountInfo.bpAccountInfo
      } else if (exchangeAccountInfo.asterAccountInfo) {
        totalNetEquity = totalNetEquity.plus(BigNumber(exchangeAccountInfo.asterAccountInfo.equity))
        accountInfo.asterAccountInfo = exchangeAccountInfo.asterAccountInfo
      }
    }
    accountInfo.totalNetEquity = totalNetEquity.toFixed(2)
    // 获取所有币种的持仓
    // 每个币种的持仓有三个交易所的持仓, 按index进行存入数组中
    // 如: 
    // 币种: BTC
    // 持仓: [bitgetBTC, bybitBTC, binanceBTC], 如没有持仓, 则存入null
    const chainTokenPositionsMap = new TSMap<string, TTokenPosition>()
    const length = this.exchangeIndexMgr.exchangeList.length
    for (let i = 0; i < length; i++) {
      const exchange = this.exchangeIndexMgr.exchangeList[i]
      const positions = await exchange.getPositions()
      for (const position of positions) {
        const exchangeToken = position.exchangeToken
        const chainToken = await TokenInfoService.getChainToken(exchange.exchangeName, exchangeToken, this.exchangeTokenInfoMap)
        if (!chainToken) {
          blogger.error(`${this.traceId} getRiskData get chainToken error, exchange: ${exchange.exchangeName}, exchangeToken: ${exchangeToken}`)
          continue
        }
        const val = chainTokenPositionsMap.get(chainToken)
        let basePositions = []
        if (!val) {
          basePositions = Array.from({ length }, () => null)
        } else {
          basePositions = val.positions
        }
        basePositions[i] = position
        chainTokenPositionsMap.set(chainToken, {
          notional: '0',
          positions: basePositions
        })
      }
    }
    let totalPositiveNotional = BigNumber(0)
    // 每个交易所的持仓价值的列表
    const exchangeRiskInfoMap = new TSMap<string, TExchangeRiskInfo>()
    // 计算每个币种的持仓
    for (const chainToken of chainTokenPositionsMap.keys()) {
      const chainTokenPosition = chainTokenPositionsMap.get(chainToken)
      if (!chainTokenPosition) {
        continue
      }
      const positions = chainTokenPosition.positions
      const tokenNotionalList = await this.getTokenNotional(chainToken, positions)
      // 计算chainToken的正持仓价值
      let chainTokenPositiveNotional = BigNumber(0)
      for (let i = 0; i < tokenNotionalList.length; i++) {
        const tokenNotional = tokenNotionalList[i]
        chainTokenPositiveNotional = chainTokenPositiveNotional.plus(tokenNotional.positiveNotional)
        const exchange = this.exchangeIndexMgr.exchangeList[i]
        const key = exchange.exchangeName
        let exchangeRiskInfo = exchangeRiskInfoMap.get(key)
        if (!exchangeRiskInfo) {
          exchangeRiskInfo = {
            totalNotional: BigNumber(0),
            positiveNotional: BigNumber(0),
            negativeNotional: BigNumber(0),
            positionCounter: 0
          }
        }
        totalPositiveNotional = totalPositiveNotional.plus(tokenNotional.positiveNotional)
        const positiveNotional = exchangeRiskInfo.positiveNotional.plus(tokenNotional.positiveNotional)
        const negativeNotional = exchangeRiskInfo.negativeNotional.plus(tokenNotional.negativeNotional)
        const totalNotional = positiveNotional.plus(negativeNotional)
        exchangeRiskInfo.totalNotional = totalNotional
        exchangeRiskInfo.positiveNotional = positiveNotional
        exchangeRiskInfo.negativeNotional = negativeNotional
        if (totalNotional.gt(0)) {
          exchangeRiskInfo.positionCounter++
        }
        exchangeRiskInfoMap.set(key, exchangeRiskInfo)
      }
      chainTokenPositionsMap.set(chainToken, {
        notional: chainTokenPositiveNotional.toFixed(2),
        positions
      })
    }
    accountInfo.totalPositiveNotional = totalPositiveNotional.toFixed(2)
    return {
      accountInfo,
      chainTokenPositionMap: chainTokenPositionsMap,
      exchangeRiskInfo: exchangeRiskInfoMap
    }
  }
}
