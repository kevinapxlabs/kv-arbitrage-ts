import { defiConfig } from "../config/config.js"
import { ExchangeAdapter } from "../exchanges/exchange.adapter.js"
import { AsterExchangeAdapter } from "../exchanges/aster.exchange.js"
import { BackpackExchangeAdapter } from "../exchanges/backpack.exchange.js"
import { TArbitrageConfig } from "./arbitrage.config.js"
import { EExchangeCexId, EExchangeId } from "../common/exchange.enum.js"

export class ExchangeIndexMgr {
  exchangeList: ExchangeAdapter[] = []
  exchangeIndexList: number[][] = []

  constructor(traceId: string, arbitrageConfig: TArbitrageConfig) {
    this.exchangeList = []
    const projectIdList = defiConfig.exchangeIdList
    // 1. 添加 backpack交易所
    if (projectIdList.includes(EExchangeId.BackPack)) {
      this.exchangeList.push(new BackpackExchangeAdapter(traceId, arbitrageConfig))
    }
    // 2. 添加 aster交易所
    if (projectIdList.includes(EExchangeId.Aster)) {
      this.exchangeList.push(new AsterExchangeAdapter(traceId, arbitrageConfig))
    }
    for (let i = 0; i < this.exchangeList.length; i++) {
      for(let j = i + 1; j < this.exchangeList.length; j++) {
        this.exchangeIndexList.push([i, j])
      }
    }
  }
}
