import BigNumber from "bignumber.js"
import { sendMsg } from "../utils/bot.js"
import { ParamsMgr } from "./params.js"
import { TRiskDataInfo } from "./type.js"
import { sleep } from "../utils/time.util.js"
import { TArbitrageConfig } from "./arbitrage.config.js"
import { EExchange } from "../common/exchange.enum.js"

let sendToTgTimestamp = 0

export class SummaryMgr {
  traceId: string
  arbitrageConfig: TArbitrageConfig

  constructor(traceId: string, arbitrageConfig: TArbitrageConfig) {
    this.traceId = traceId
    this.arbitrageConfig = arbitrageConfig
  }

  checkToTg(): boolean {
    const nowDate = new Date()
    const minutes = nowDate.getMinutes()
    const diffTime = nowDate.getTime() - sendToTgTimestamp
    const check1 = minutes % ParamsMgr.MINUTES_INTERVAL === 0 && diffTime > 200 * 1000
    if (check1) {
      sendToTgTimestamp = nowDate.getTime()
      return true
    }
    return false
  }

  getPositions(riskData: TRiskDataInfo): string[] {
    let texts: string[] = []
    const chainTokenKeys = riskData.chainTokenPositionMap.keys()
    const totalNotional = riskData.accountInfo.totalPositiveNotional
    for(const chainToken of chainTokenKeys) {
      const tokenPosition = riskData.chainTokenPositionMap.get(chainToken)
      if (tokenPosition) {
        const notional = BigNumber(tokenPosition.notional).toFixed(2)
        let postitionAmt = BigNumber(0)
        for (const position of tokenPosition.positions) {
          if (position && BigNumber(position.positionAmt).gt(0)) {
            postitionAmt = postitionAmt.plus(position.positionAmt)
          }
        }
        const content = `【${chainToken}】: ${postitionAmt.toFixed(1)}($${notional})`
        texts.push(content)
      }
    }
    const textsLength = texts.length
    // 只取30个仓位信息
    if (textsLength > 20) {
      texts.push(`【PositionLength】: ${textsLength}`)
    }
    texts.push(`【TotalNotional】: $${totalNotional}`)
    return texts
  }

  async positionToTg(riskData: TRiskDataInfo) {
    const texts = ['【通知主题】: 持仓信息']
    const positions = this.getPositions(riskData)
    texts.push(...positions)
    const content = texts.join('\n')
    await sendMsg(ParamsMgr.TgNoticeName, content)
  }

  async getRiskData(riskData: TRiskDataInfo): Promise<string[]> {
    const accountInfo = riskData.accountInfo
    const exchangeRiskInfo = riskData.exchangeRiskInfo
    const texts: string[] = []

    // aster
    const asterAccountInfo = accountInfo.asterAccountInfo
    if (asterAccountInfo) {
      const bitgetInfo = exchangeRiskInfo.get(EExchange.Aster)
      let bitgetNotional = ''
      if (bitgetInfo) {
        const bitgetLeverage = BigNumber(bitgetInfo.totalNotional).dividedBy(asterAccountInfo.equity).toFixed(1)
        bitgetNotional = `$${BigNumber(asterAccountInfo.equity).toFixed(1)}($${bitgetInfo.totalNotional})(${bitgetLeverage})`
        texts.push(`【asterNotional】: ${bitgetNotional}`)
      }
    }
    // backpack
    const bpAccountInfo = accountInfo.bpAccountInfo
    if (bpAccountInfo) {
      const backpackInfo = exchangeRiskInfo.get(EExchange.Backpack)
      let backpackNotional = ''
      if (backpackInfo) {
        const backpackLeverage = BigNumber(backpackInfo.totalNotional).dividedBy(bpAccountInfo.equity).toFixed(1)
        backpackNotional = `$${BigNumber(bpAccountInfo.equity).toFixed(1)}($${backpackInfo.totalNotional})(${backpackLeverage})`
        texts.push(`【backpackNotional】: ${backpackNotional}`)
      }
    }
    // 获取nav
    const totalEquity = BigNumber(accountInfo.totalNetEquity)
    const navPerShare = totalEquity.dividedBy(this.arbitrageConfig.SHARES).multipliedBy(100)
    texts.push(`【Nav】: $${totalEquity.toFixed(2)}`)
    texts.push(`【Nav%】: ${navPerShare.toFixed(2)}%`)
    return texts
  }

  async fundingFeeToTg(riskData: TRiskDataInfo) {
    const texts = ['【通知主题】: 风控信息']
    const riskDataTexts = await this.getRiskData(riskData)
    texts.push(...riskDataTexts)
    const content = texts.join('\n')
    // console.log(content)
    await sendMsg(ParamsMgr.TgNoticeName, content)
  }

  async toTg(riskData: TRiskDataInfo) {
    await this.positionToTg(riskData)
    await sleep(300)
    await this.fundingFeeToTg(riskData)
  }

  async run(riskData: TRiskDataInfo) {
    if (this.checkToTg()) {
      await this.toTg(riskData)
    }
  }
}