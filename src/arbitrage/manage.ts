import { blogger } from "../common/base/logger.js";
import { ArbitrageBase } from "./base.js";
import { RiskDataMgr } from "./risk.data.js";
import { ArbitrageConfig } from "./arbitrage.config.js";
import { TokenInfoService } from "../service/tokenInfo.service.js";
import { ExchangeIndexMgr } from "./exchange.index.js";
import { LeverageMgr } from "./leverage.js";
import { RebalanceMgr } from "./rebalance.js";
import { TRiskDataInfo } from "./type.js";
import { ExchangeAdapter } from "../exchanges/exchange.adapter.js";
import { EPositionDescrease } from "../common/types/exchange.type.js";
import { OpportunityMgr } from "./opportunity.js";
import { SettlementMgr } from "./settlement.js";
import { SummaryMgr } from "./summary.js";
import { NoticeMgr } from "./notice.js";

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

      // 6. 判断减仓等级方向
      const direction = this.checkDescrease(riskData, exchangeIndexMgr.exchangeList)
      blogger.info(`${this.traceId} get direction: ${direction}`)

      // 7. 获取机会
      const opportunityMgr = new OpportunityMgr(this.traceId)
      await opportunityMgr.run(riskData)

      // 11. 利润锁定
      const profitLockedMgr = new SettlementMgr(this.traceId, exchangeIndexMgr, arbitrageConfig, exchangeTokenInfoMap)
      await profitLockedMgr.run(riskData)

      // 12. 生成总结
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

