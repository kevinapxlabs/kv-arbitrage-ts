import { TSMap } from "../libs/tsmap.js"
import { TExchangeTokenInfo, TTokenInfo } from "../service/tokenInfo.service.js"
import { TArbitrageConfig } from "./arbitrage.config.js"
import { ExchangeIndexMgr } from "./exchange.index.js"
import { TRiskDataInfo } from "./type.js"

export class OpportunityMgr {
  traceId: string
  exchangeIndexMgr: ExchangeIndexMgr
  arbitrageConfig: TArbitrageConfig
  tokenInfoMap: TSMap<string, TTokenInfo>
  exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>

  constructor(
    traceId: string,
    exchangeIndexMgr: ExchangeIndexMgr,
    arbitrageConfig: TArbitrageConfig,
    tokenInfoMap: TSMap<string, TTokenInfo>,
    exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  ) {
    this.traceId = traceId
    this.exchangeIndexMgr = exchangeIndexMgr
    this.arbitrageConfig = arbitrageConfig
    this.tokenInfoMap = tokenInfoMap
    this.exchangeTokenInfoMap = exchangeTokenInfoMap
  }

  async run(riskData: TRiskDataInfo) {}
}
