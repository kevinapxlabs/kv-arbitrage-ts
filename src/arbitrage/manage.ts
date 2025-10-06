import { blogger } from "../common/base/logger.js";
import { ArbitrageBase } from "./base.js";
import { RiskDataMgr } from "./risk.data.js";
import { ArbitrageConfig } from "./arbitrage.config.js";
import { TokenInfoService } from "../service/tokenInfo.service.js";
import { ExchangeIndexMgr } from "./exchange.index.js";
import { LeverageMgr } from "./leverage.js";
import { RebalanceMgr } from "./rebalance.js";
import { TRiskDataInfo, TTokenPosition } from "./type.js";
import { ExchangeAdapter } from "../exchanges/exchange.adapter.js";
import { EPositionDescrease, TCoinData } from "../common/types/exchange.type.js";
import { OpportunityMgr } from "./opportunity.js";
import { SettlementMgr } from "./settlement.js";
import { SummaryMgr } from "./summary.js";
import { NoticeMgr } from "./notice.js";
import { FundingFeeMgr } from "./fundingFee.data.js";
import { TSMap } from "../libs/tsmap.js";
import { DecreaseMgr } from "./decrease.js";
import { RiskDataMock } from "../mock/riskdata.mock.js";

/*
* 管理funding fee 的所有逻辑，包括减仓、加仓、杠杆调整、rebalance、利润锁定、总结
* 作为定时任务触发
*/
export class ArbitrageManage extends ArbitrageBase {
  isRunning = false

  constructor() {
    const traceId = `cross manager ${new Date().getTime()}`
    super(traceId)
  }

  checkDescrease(riskData: TRiskDataInfo, exchangeList: ExchangeAdapter[]): EPositionDescrease {
    for (const exchange of exchangeList) {
      const isDecrease = exchange.isDecrease(riskData)
      blogger.info(`${this.traceId}, exchange: ${exchange.exchangeName}, check decrease: ${isDecrease}`)
      if (isDecrease) {
        return isDecrease
      }
    }
    return EPositionDescrease.None
  }

  getFundingfeeLog(coinData: TCoinData[], msg: string) {
    const minTotal = 12
    const logs = new TSMap<string, string>()
    for (const coin of coinData) {
      if (coin.total.abs().gt(minTotal)) {
        const key = `${coin.chainToken}-${coin.baseExchange}-${coin.quoteExchange}`
        logs.set(key, `${coin.baseExchange}:${coin.baseExchangeRate.toFixed(3)}, ${coin.quoteExchange}:${coin.quoteExchangeRate.toFixed(3)}, total:${coin.total.toFixed(3)}`)
      }
      if (logs.size() >= 10) {
        blogger.info(`${this.traceId} ${msg}: ${JSON.stringify(logs.toJSON())}`)
        logs.clear()
      }
    }
    if (logs.size() > 0) {
      blogger.info(`${this.traceId} ${msg}: ${JSON.stringify(logs.toJSON())}`)
    }
  }

  // 打印position信息
  positionToLog(chainTokenPositionMap: TSMap<string, TTokenPosition>) {
    const logs: string[] = []
    for (const chainToken of chainTokenPositionMap.keys()) {
      const postiionList = chainTokenPositionMap.get(chainToken)
      if (postiionList) {
        const p = postiionList.positions
        const plogs: string[] = []
        for (const p of postiionList.positions) {
          if (p) {
            plogs.push(p.positionAmt)
          } else {
            plogs.push('null')
          }
        }
        logs.push(`${chainToken}: ${plogs.join('|')}`)
      }
    }
    blogger.info(`${this.traceId} positions token symbols: ${logs.join(',')}`)
  }

  async _run() {
    try {
      // 1. 获取资费配置
      const arbitrageConfig = await ArbitrageConfig.getConfig()
      // 2. 检查系统是否暂停
      if (arbitrageConfig.PAUSE) {
        blogger.info(`${this.traceId} funding fee is paused`)
        return
      }
      const tokenInfoMap = await TokenInfoService.getFuturesTokenMap()
      const exchangeTokenInfoMap = await TokenInfoService.getFuturesExchangeTokenInfoMap()
      const exchangeIndexMgr = new ExchangeIndexMgr(this.traceId, arbitrageConfig)
      // 3. 获取交易所风控数据
      const riskMgr = new RiskDataMgr(this.traceId, exchangeIndexMgr, exchangeTokenInfoMap)
      const riskData = await riskMgr.getRiskData()
      // const riskData = RiskDataMock.getRiskData()
      blogger.info(`${this.traceId} riskData: ${JSON.stringify(riskData.accountInfo)}`)
      this.positionToLog(riskData.chainTokenPositionMap)
      blogger.info(`${this.traceId} exchangeRiskInfo: ${JSON.stringify(riskData.exchangeRiskInfo.toJSON())}`)

      // 4. 调整杠杆
      const leverageMgr = new LeverageMgr(this.traceId, exchangeTokenInfoMap)
      await leverageMgr.run(exchangeIndexMgr.exchangeList, riskData)

      // 5. 判断各交易所间做空与做多持仓数量是否相同
      const rebalanceMgr = new RebalanceMgr(this.traceId, exchangeIndexMgr, arbitrageConfig, exchangeTokenInfoMap)
      const isRebalance = await rebalanceMgr.rebalances(riskData)
      blogger.info(`${this.traceId} rebalance result: ${isRebalance}`)
      if (isRebalance) {
        return
      }

      // 6. 获取当前资费数据
      const fundingFeeMgr = new FundingFeeMgr(this.traceId, exchangeIndexMgr, tokenInfoMap)
      const currentFundingFeeData = await fundingFeeMgr.getCurrentFundingFeeData()
      this.getFundingfeeLog(currentFundingFeeData, 'current funding fee data')

      // 7. 判断减仓等级方向
      const direction = this.checkDescrease(riskData, exchangeIndexMgr.exchangeList)
      blogger.info(`${this.traceId} get direction: ${direction}`)

      // 8. 减仓，根据目前资费数据进行减仓
      if (direction === EPositionDescrease.Decrease) {
        const decreaseMgr = new DecreaseMgr(this.traceId, exchangeIndexMgr, arbitrageConfig, exchangeTokenInfoMap)
        await decreaseMgr.decreasePosition(riskData, currentFundingFeeData)
      } else if (direction === EPositionDescrease.DecreasePercent) {
        // 8.1. 减仓20%
        blogger.info(`${this.traceId} decrease position percent: 20%`)
        const decreaseMgr = new DecreaseMgr(this.traceId, exchangeIndexMgr, arbitrageConfig, exchangeTokenInfoMap)
        await decreaseMgr.decreasePosition(riskData, currentFundingFeeData, 0.2)
      }

      // 9. 获取机会
      const opportunityMgr = new OpportunityMgr(this.traceId, exchangeIndexMgr, arbitrageConfig, tokenInfoMap, exchangeTokenInfoMap)
      await opportunityMgr.run(riskData, currentFundingFeeData)

      // 10. 利润锁定
      const profitLockedMgr = new SettlementMgr(this.traceId, exchangeIndexMgr, arbitrageConfig, exchangeTokenInfoMap)
      await profitLockedMgr.run(riskData, currentFundingFeeData)

      // 11. 生成总结
      const summaryMgr = new SummaryMgr(this.traceId, arbitrageConfig)
      await summaryMgr.run(riskData)
    } catch(err: any) {
      console.debug(err)
      let msg = `${this.traceId} cross manager run error: ${JSON.stringify(err)}`
      if (err.message) {
        msg = `${this.traceId} cross manager run error: ${err.message}`
      } 
      blogger.error(msg)
      NoticeMgr.sendMainErrorMsg(this.traceId, msg)
    }
  }
  
  async run() {
    if (this.isRunning) {
      blogger.info(`${this.traceId} cross manager is running`)
      return
    }
    const startTime = new Date().getTime()
    this.traceId = `cross manager ${startTime}`
    this.isRunning = true
    await this._run()
    this.isRunning = false
    const endTime = new Date().getTime()
    blogger.info(`${this.traceId} cross manager cost time: ${endTime - startTime}ms`)
  }
}

