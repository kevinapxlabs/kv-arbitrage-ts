import { TArbitrageConfig } from "../arbitrage/arbitrage.config.js"
import { blogger } from "../common/base/logger.js"

// 价格差服务管理类
export class PriceDeltaService {
  traceId: string
  arbitrageConfig: TArbitrageConfig

  constructor(traceId: string, arbitrageConfig: TArbitrageConfig) {
    this.traceId = traceId
    this.arbitrageConfig = arbitrageConfig
  }

  clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  /*
  * 获取增加仓位时的价格差最低要求
  * 8. 当funding_fee_bps 是 funding_fee_tolerate_bps的1倍时，额外补偿达到 price_delta_increase_min_bps的1.2倍
  * 不是线性的，funding_fee_bps越小，补偿越多
  * @param fundingFeeBps 资费差 bps
  * @returns 价格差 bps
  */
  getIncreasePositionPriceDelta(fundingFeeBps: number): number {
    const alpha = 0.2
    const increaseFundingFeeTolerateBps = this.arbitrageConfig.INCREASE_FUNDING_FEE_TOLERATE_BPS
    const increasePriceDeltaBps = this.arbitrageConfig.INCREASE_PRICE_DELTA_BPS
    if (fundingFeeBps < increaseFundingFeeTolerateBps) {
      return increasePriceDeltaBps * 5
    } else if (fundingFeeBps > 0) {
      return increasePriceDeltaBps
    } else {
      // 资费差越大，价格差要求越大
      const fundingFeeRatio = Math.pow(fundingFeeBps / increaseFundingFeeTolerateBps, 2)
      const requiredPriceDelta = increasePriceDeltaBps * (1 + alpha * fundingFeeRatio)
      return requiredPriceDelta
    }
  }

  /*
  * 获取减仓时的价格差最低要求
  * @param fundingFeeBps 资费差 bps
  * @param holdHours 持仓时长
  * @param nextFundingTime 下一轮资费时间
  * @returns 价格差 bps
  */
  getDecreasePositionPriceDelta(fundingFeeBps: number, holdHours: number, nextFundingTime: number): number {
    const priceDeltaMin = this.arbitrageConfig.SETTLEMENT_PRICE_DELTA_BPS_MIN
    // 1. 资费差为正，则资费对价差没有影响，只有持仓时长影响价差
    if (fundingFeeBps > 0) {
      return priceDeltaMin
    } else {
      const priceDeltaMax = this.arbitrageConfig.SETTLEMENT_PRICE_DELTA_BPS_MAX
      const priceDeltaTolerateBps = this.arbitrageConfig.SETTLEMENT_PRICE_DELTA_TOLERATE_BPS
      const holdMaxHours = this.arbitrageConfig.SETTLEMENT_HOLD_MAX_HOURS
      const fundingFeeMaxBadBps = -this.arbitrageConfig.SETTLEMENT_FUNDING_FEE_MAX_BAD_BPS
      const fundingFeeExtremeBadBps = -this.arbitrageConfig.SETTLEMENT_FUNDING_FEE_EXTREME_BAD_BPS

      const w_t = 0.5, w_f = 0.5
      const fAdv = -fundingFeeBps
      // step 1: time/funding ratio
      const u_t = this.clamp(holdHours / holdMaxHours, 0, 1);
      const u_f = this.clamp(fAdv / fundingFeeMaxBadBps, 0, 1);
      const blend = this.clamp(w_t * u_t + w_f * u_f, 0, 1);
      const p0 = (1 - blend) * priceDeltaMax + blend * priceDeltaMin;

      const now = Date.now()
      const diffTime = nextFundingTime - now
      let s = 0, ex_t = 0, ex_f = 0
      // 只有在距离下一轮资费时间小于30min时，才允许资费差低于maxBadBps
      if (diffTime < 1800 * 1000) {
        // Step 2: extreme override — allow below-min
        ex_t = this.clamp((holdHours - holdMaxHours) / holdMaxHours, 0, 1);
        ex_f = this.clamp((fAdv - fundingFeeMaxBadBps) / (fundingFeeExtremeBadBps - fundingFeeMaxBadBps), 0, 1);
        s = 1 - (1 - ex_f) * (1 - ex_t);
      }

      const p = (1 - s) * p0 + s * priceDeltaTolerateBps;
      blogger.info(`${this.traceId} get decrease position price delta, fundingFeeBps: ${fundingFeeBps}, holdHours: ${holdHours}, u_t: ${u_t}, u_f: ${u_f}, blend: ${blend}, p0: ${p0}, ex_t: ${ex_t}, ex_f: ${ex_f}, s: ${s}, priceDelta: ${p}`)
      return p
    }
  }
}
