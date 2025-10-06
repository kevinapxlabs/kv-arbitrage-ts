import BigNumber from 'bignumber.js'
import { blogger } from '../common/base/logger.js'
import { EExchange, EExchangeCexId, EExchangeId, EKVSide } from '../common/exchange.enum.js'
import type { TQtyFilter } from '../manager/marketinfo/maretinfo.type.js'
import type { ExchangeAdapter } from './exchange.adapter.js'
import type { TAccountInfo, TAsterAccountInfo, TBNKey, TCancelOrder, TKVFundingFee, TKVPosition, TQueryOrder } from './types.js'
import {
  AsterAccountApi,
  AsterNewOrderRespType,
  AsterOrderSide,
  AsterOrderStatus,
  AsterOrderType,
  AsterPositionSide,
  AsterTimeInForce
} from '../libs/aster/index.js'
import type { AsterAccountPosition } from '../libs/aster/aster.types.js'
import { AsterMarketInfoMgr } from '../manager/marketinfo/aster.marketinfo.js'
import { TArbitrageConfig } from '../arbitrage/arbitrage.config.js'
import { getKeyInfo } from '../utils/bnKey.js'
import { defiConfig } from '../config/config.js'
import { EPositionDescrease } from '../common/types/exchange.type.js'
import { TRiskDataInfo } from '../arbitrage/type.js'
import { ExchangeDataMgr } from '../arbitrage/exchange.data.js'
import { IncreasePositionDiscount } from './constant.js'

const COMPLETED_ORDER_STATUSES = new Set<
  AsterOrderStatus
>([
  AsterOrderStatus.FILLED,
  AsterOrderStatus.CANCELED,
  AsterOrderStatus.REJECTED,
  AsterOrderStatus.EXPIRED
])

type AsterOrderIdentifier = { orderId?: number; origClientOrderId?: string }

export class AsterExchangeAdapter implements ExchangeAdapter {
  readonly traceId: string
  readonly exchangeId = EExchangeId.Aster
  readonly cexId = EExchangeCexId.Aster
  readonly exchangeName = EExchange.Aster
  readonly settlementAsset = 'USDT'
  readonly arbitrageConfig: TArbitrageConfig

  constructor(traceId: string, arbitrageConfig: TArbitrageConfig) {
    this.traceId = traceId
    this.arbitrageConfig = arbitrageConfig
  }

  private getKeyInfo(): TBNKey {
    const asterCfg = defiConfig.asterCfg
    return getKeyInfo(asterCfg.apiKey, asterCfg.apiSecret, '', defiConfig.pwd)
  }

  isIncrease(riskData: TRiskDataInfo): boolean {
    const asterAcc = riskData.accountInfo.asterAccountInfo
    if (!asterAcc) {
      return false
    }
    return asterAcc.marginFraction < this.arbitrageConfig.ASTER_MARGIN_RATIO_1 && asterAcc.initialMarginFraction < IncreasePositionDiscount
  }

  isDecrease(riskData: TRiskDataInfo): EPositionDescrease {
    const asterAcc = riskData.accountInfo.asterAccountInfo
    if (!asterAcc) {
      return EPositionDescrease.None
    }
    if (asterAcc.marginFraction > this.arbitrageConfig.ASTER_MARGIN_RATIO_3) {
      return EPositionDescrease.DecreasePercent
    } else if (asterAcc.marginFraction > this.arbitrageConfig.ASTER_MARGIN_RATIO_2) {
      return EPositionDescrease.Decrease
    }
    return EPositionDescrease.None
  }

  generateExchangeSymbol(exchangeToken: string): string {
    const token = this.normalizePair(exchangeToken)
    return `${token}${this.settlementAsset}`
  }

  generateOrderbookSymbol(exchangeToken: string): string {
    const token = this.normalizePair(exchangeToken)
    return `${token}${this.settlementAsset}`
  }

  getExchangeToken(symbol: string): string {
    const normalized = this.normalizePair(symbol)
    return normalized.slice(0, -this.settlementAsset.length)
  }

  async getAccountInfo(): Promise<TAccountInfo> {
    const keyInfo = this.getKeyInfo()
    const accountApi = new AsterAccountApi({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      const accountInfo = await accountApi.getAccountInfo()
      const { totalInitialMargin, totalMaintMargin, totalMarginBalance } = accountInfo
      blogger.info(`${this.traceId} aster margin ratio, totalInitialMargin: ${totalInitialMargin}, totalMaintMargin: ${totalMaintMargin}, totalMarginBalance: ${totalMarginBalance}`)
      const imr = parseFloat(totalInitialMargin) / parseFloat(totalMarginBalance)
      const mmr = parseFloat(totalMaintMargin) / parseFloat(totalMarginBalance)
      const asterAcc: TAsterAccountInfo = {
        initialMarginFraction: imr,
        marginFraction: mmr,
        equity: totalMarginBalance
      }
      return {
        totalNetEquity: accountInfo.totalMarginBalance,
        totalPositiveNotional: accountInfo.totalPositionInitialMargin,
        asterAccountInfo: asterAcc,
        bpAccountInfo: null
      }
    } catch (error) {
      blogger.error('aster getAccountInfo failed', error)
      throw this.ensureError(error)
    }
  }

  async getPositions(): Promise<TKVPosition[]> {
    const keyInfo = this.getKeyInfo()
    const accountApi = new AsterAccountApi({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      const account = await accountApi.getAccountInfo()
      return account.positions
        .filter((position) => Number(position.positionAmt) !== 0)
        .map((position) => this.toKVPosition(position))
    } catch (error) {
      blogger.error('aster getPositions failed', error)
      throw this.ensureError(error)
    }
  }

  async ensureLeverage(symbol: string, leverage: number): Promise<void> {
    blogger.info('aster ensureLeverage', { symbol, leverage })
    const keyInfo = this.getKeyInfo()
    const accountApi = new AsterAccountApi({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      await accountApi.setLeverage({ symbol, leverage })
    } catch (error) {
      blogger.error('aster ensureLeverage failed', { symbol, leverage, error })
      throw this.ensureError(error)
    }
  }

  async getQtyFilter(symbol: string): Promise<TQtyFilter | undefined> {
    const normalized = this.normalizePair(symbol)
    try {
      const rule = await AsterMarketInfoMgr.getFutureSymbolRule(normalized)
      if (!rule) {
        return undefined
      }
      return rule
    } catch (error) {
      blogger.error('aster load exchange info failed', error)
      return undefined
    }
  }

  async placeMarketOrder(symbol: string, side: EKVSide, quantity: string, reduceOnly: boolean): Promise<string> {
    const keyInfo = this.getKeyInfo()
    const accountApi = new AsterAccountApi({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      const response = await accountApi.createOrder({
        symbol,
        side: this.toOrderSide(side),
        type: AsterOrderType.MARKET,
        quantity,
        positionSide: AsterPositionSide.BOTH,
        reduceOnly,
        newOrderRespType: AsterNewOrderRespType.RESULT
      })
      return String(response.orderId)
    } catch (error) {
      blogger.error('aster placeMarketOrder failed', { symbol, side, quantity, error })
      throw this.ensureError(error)
    }
  }

  async placeLimitOrder(symbol: string, side: EKVSide, quantity: string, price: string, reduceOnly: boolean): Promise<string> {
    const keyInfo = this.getKeyInfo()
    const accountApi = new AsterAccountApi({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      const response = await accountApi.createOrder({
        symbol,
        side: this.toOrderSide(side),
        type: AsterOrderType.LIMIT,
        quantity,
        price,
        reduceOnly,
        timeInForce: AsterTimeInForce.GTC,
        positionSide: AsterPositionSide.BOTH,
        newOrderRespType: AsterNewOrderRespType.RESULT
      })
      return String(response.orderId)
    } catch (error) {
      blogger.error('aster placeLimitOrder failed', { symbol, side, quantity, price, error })
      throw this.ensureError(error)
    }
  }

  async queryOrder(symbol: string, orderId: string): Promise<TQueryOrder> {
    const identifier = this.parseOrderIdentifier(orderId)
    const keyInfo = this.getKeyInfo()
    const accountApi = new AsterAccountApi({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      const response = await accountApi.queryOrder({ symbol, ...identifier })
      return {
        isCompleted: COMPLETED_ORDER_STATUSES.has(response.status),
        result: response
      }
    } catch (error) {
      blogger.error('aster queryOrder failed', { symbol, orderId, error })
      throw this.ensureError(error)
    }
  }

  async cancelOrder(symbol: string, orderId: string): Promise<TCancelOrder> {
    const identifier = this.parseOrderIdentifier(orderId)
    const keyInfo = this.getKeyInfo()
    const accountApi = new AsterAccountApi({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      const response = await accountApi.cancelOrder({ symbol, ...identifier })
      return { orderId: String(response.orderId ?? orderId) }
    } catch (error) {
      blogger.error('aster cancelOrder failed', { symbol, orderId, error })
      throw this.ensureError(error)
    }
  }

  async getCurrentFundingFee(symbol: string): Promise<TKVFundingFee> {
    const fundingFee = await ExchangeDataMgr.getFundingFee(EExchange.Aster, symbol)
    return fundingFee ? { fundingFee: BigNumber(fundingFee.fundingFee), nextFundingTime: fundingFee.nextFundingTime } : { fundingFee: BigNumber(0), nextFundingTime: 0 }
  }

  async getSymbolInterval(symbol: string): Promise<number> {
    try {
      const interval = await AsterMarketInfoMgr.getFundingIntervalHours(symbol)
      return interval ?? 0
    } catch (error) {
      blogger.error('aster getSymbolInterval failed', { symbol, error })
      return 0
    }
  }

  private normalizePair(symbol: string): string {
    return symbol.trim().toUpperCase()
  }

  private toOrderSide(side: EKVSide): AsterOrderSide {
    return side === EKVSide.SHORT ? AsterOrderSide.SELL : AsterOrderSide.BUY
  }

  private parseOrderIdentifier(orderId: string): AsterOrderIdentifier {
    if (/^\d+$/.test(orderId)) {
      const numericId = Number(orderId)
      if (Number.isFinite(numericId)) {
        return { orderId: numericId }
      }
    }
    return { origClientOrderId: orderId }
  }

  private toKVPosition(position: AsterAccountPosition): TKVPosition {
    return {
      exchangeName: this.exchangeName,
      symbol: position.symbol,
      exchangeToken: this.getExchangeToken(position.symbol),
      leverage: position.leverage,
      positionAmt: position.positionAmt,
      notional: this.computeNotional(position)
    }
  }

  private computeNotional(position: AsterAccountPosition): string {
    const qty = Number(position.positionAmt)
    const price = Number(position.entryPrice)
    const value = Math.abs(qty * price)
    return Number.isFinite(value) ? value.toString() : '0'
  }

  private ensureError(error: unknown): Error {
    if (error instanceof Error) {
      return error
    }
    return new Error(String(error))
  }
}
