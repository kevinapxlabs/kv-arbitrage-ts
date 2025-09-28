import { TRiskDataInfo } from "./type.js"

export class OpportunityMgr {
  traceId: string

  constructor(traceId: string) {
    this.traceId = traceId
  }

  async run(riskData: TRiskDataInfo) {}
}
