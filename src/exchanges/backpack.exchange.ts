import { blogger } from '../common/base/logger.js'
import { EExchange, EExchangeCexId, EExchangeId, EKVSide } from '../common/exchange.enum.js'
import type { TQtyFilter } from '../manager/marketinfo/maretinfo.type.js'
import type { ExchangeAdapter } from './exchange.adapter.js'
import type { TAccountInfo, TBNKey, TCancelOrder, TKVPosition, TQueryOrder } from './types.js'
import {
  BackpackAccountApi,
  BackpackTradingApi
} from '../libs/backpack/index.js'
import type {
  BackpackFuturePositionWithMargin,
  BackpackOrderStatus
} from '../libs/backpack/backpack.types.js'
import { BackpackMarketInfoMgr } from '../manager/marketinfo/backpack.marketinfo.js'
import { TArbitrageConfig } from '../arbitrage/arbitrage.config.js'
import { defiConfig } from '../config/config.js'
import { getKeyInfo } from '../utils/bnKey.js'
import { EPositionDescrease } from '../common/types/exchange.type.js'
import { TRiskDataInfo } from '../arbitrage/type.js'
import { ExchangeDataMgr } from '../arbitrage/exchange.data.js'

const COMPLETED_ORDER_STATUSES = new Set<BackpackOrderStatus>([
  'Cancelled',
  'Expired',
  'Filled',
  'TriggerFailed'
])

interface BackpackOrderIdentifier {
  orderId?: string
  clientId?: number
}

export class BackpackExchangeAdapter implements ExchangeAdapter {
  readonly traceId: string
  readonly id = EExchangeId.Backpack
  readonly cexId = EExchangeCexId.BackPack
  readonly exchangeName = EExchange.Backpack
  readonly settlementAsset = 'USDC'

  readonly arbitrageConfig: TArbitrageConfig

  constructor(traceId: string, arbitrageConfig: TArbitrageConfig) {
    this.traceId = traceId
    this.arbitrageConfig = arbitrageConfig
  }

  isIncrease(riskData: TRiskDataInfo): boolean {
    return false
  }

  isDecrease(riskData: TRiskDataInfo): EPositionDescrease {
    return EPositionDescrease.None
  } 

  private getKeyInfo(): TBNKey {
    const backpackCfg = defiConfig.backpackCfg
    return getKeyInfo(backpackCfg.apiKey, backpackCfg.apiSecret, '', defiConfig.pwd)
  }

  generateExchangeSymbol(exchangeToken: string): string {
    const token = this.normalizeSymbol(exchangeToken)
    return `${token}_${this.settlementAsset}_PERP`
  }

  generateOrderbookSymbol(exchangeToken: string): string {
    const token = this.normalizeSymbol(exchangeToken)
    return `${token}_${this.settlementAsset}_PERP`
  }

  getExchangeToken(symbol: string): string {
    const normalized = this.normalizeSymbol(symbol)
    const symbolParts = normalized.split('_')
    if (symbolParts.length === 3) {
      return symbolParts[0]
    }
    return normalized
  }

  async getAccountInfo(): Promise<TAccountInfo> {
    const keyInfo = this.getKeyInfo()
    const accountApi = new BackpackAccountApi({
      apiKey: keyInfo.apiKey,
      privateKey: keyInfo.secret
    })
    try {
      const summary = await accountApi.getMarginSummary()
      return {
        totalNetEquity: summary.netEquity,
        totalPositiveNotional: summary.netExposureFutures ?? '0',
        bpAccountInfo: null,
        asterAccountInfo: null
      }
    } catch (error) {
      blogger.error('backpack getAccountInfo failed', error)
      throw this.ensureError(error)
    }
  }

  async getPositions(): Promise<TKVPosition[]> {
    const keyInfo = this.getKeyInfo()
    const tradingApi = new BackpackTradingApi({
      apiKey: keyInfo.apiKey,
      privateKey: keyInfo.secret
    })
    try {
      const positions = await tradingApi.getPositions()
      return positions
        .filter((position) => Number(position.netQuantity) !== 0)
        .map((position) => this.toKVPosition(position))
    } catch (error) {
      blogger.error('backpack getPositions failed', error)
      throw this.ensureError(error)
    }
  }

  async ensureLeverage(symbol: string, leverage: number): Promise<void> {}

  async getQtyFilter(symbol: string): Promise<TQtyFilter | undefined> {
    const normalized = this.normalizeSymbol(symbol)
    try {
      const rule = await BackpackMarketInfoMgr.getFutureSymbolRule(normalized)
      if (!rule) {
        return undefined
      }
      return rule
    } catch (error) {
      blogger.error('backpack load markets failed', error)
      return undefined
    }
  }

  async placeMarketOrder(symbol: string, side: EKVSide, quantity: string): Promise<string> {
    const keyInfo = this.getKeyInfo()
    const tradingApi = new BackpackTradingApi({
      apiKey: keyInfo.apiKey,
      privateKey: keyInfo.secret
    })
    try {
      const response = await tradingApi.submitOrder({
        symbol,
        side: this.toOrderSide(side),
        orderType: 'Market',
        quantity,
        timeInForce: 'GTC'
      })
      return response.id
    } catch (error) {
      blogger.error('backpack placeMarketOrder failed', { symbol, side, quantity, error })
      throw this.ensureError(error)
    }
  }

  async placeLimitOrder(symbol: string, side: EKVSide, quantity: string, price: string): Promise<string> {
    const keyInfo = this.getKeyInfo()
    const tradingApi = new BackpackTradingApi({
      apiKey: keyInfo.apiKey,
      privateKey: keyInfo.secret
    })
    try {
      const response = await tradingApi.submitOrder({
        symbol,
        side: this.toOrderSide(side),
        orderType: 'Limit',
        quantity,
        price,
        timeInForce: 'GTC'
      })
      return response.id
    } catch (error) {
      blogger.error('backpack placeLimitOrder failed', { symbol, side, quantity, price, error })
      throw this.ensureError(error)
    }
  }

  async queryOrder(symbol: string, orderId: string): Promise<TQueryOrder> {
    const identifier = this.parseOrderIdentifier(orderId)
    const keyInfo = this.getKeyInfo()
    const tradingApi = new BackpackTradingApi({
      apiKey: keyInfo.apiKey,
      privateKey: keyInfo.secret
    })
    try {
      const response = await tradingApi.getOrder({ symbol, ...identifier })
      return {
        isCompleted: COMPLETED_ORDER_STATUSES.has(response.status),
        result: response
      }
    } catch (error) {
      blogger.error('backpack queryOrder failed', { symbol, orderId, error })
      throw this.ensureError(error)
    }
  }

  async cancelOrder(symbol: string, orderId: string): Promise<TCancelOrder> {
    const identifier = this.parseOrderIdentifier(orderId)
    const keyInfo = this.getKeyInfo()
    const tradingApi = new BackpackTradingApi({
      apiKey: keyInfo.apiKey,
      privateKey: keyInfo.secret
    })
    try {
      const response = await tradingApi.cancelOrder({ symbol, ...identifier })
      return { orderId: response.id ?? orderId }
    } catch (error) {
      blogger.error('backpack cancelOrder failed', { symbol, orderId, error })
      throw this.ensureError(error)
    }
  }

  async getCurrentFundingFee(symbol: string): Promise<BigNumber> {
    const fundingFee = await ExchangeDataMgr.getFundingFee(EExchange.Backpack, symbol)
    return fundingFee ? BigNumber(fundingFee) : BigNumber(0)
  }

  async getSymbolInterval(symbol: string): Promise<number> {
    try {
      const interval = await BackpackMarketInfoMgr.getFundingIntervalHours(symbol)
      return interval ?? 0
    } catch (error) {
      blogger.error('backpack getSymbolInterval failed', { symbol, error })
      return 0
    }
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.trim().toUpperCase()
  }

  private toOrderSide(side: EKVSide): 'Bid' | 'Ask' {
    return side === EKVSide.SHORT ? 'Ask' : 'Bid'
  }

  private parseOrderIdentifier(orderId: string): BackpackOrderIdentifier {
    if (/^\d+$/.test(orderId)) {
      const numericId = Number(orderId)
      if (Number.isSafeInteger(numericId)) {
        return { clientId: numericId }
      }
    }
    return { orderId }
  }

  private toKVPosition(position: BackpackFuturePositionWithMargin): TKVPosition {
    return {
      exchangeName: this.exchangeName,
      symbol: position.symbol,
      exchangeToken: this.getExchangeToken(position.symbol),
      leverage: this.deriveLeverage(position),
      positionAmt: position.netQuantity,
      notional: position.netExposureNotional
    }
  }

  private deriveLeverage(position: BackpackFuturePositionWithMargin): string {
    const imf = Number(position.imf)
    if (Number.isFinite(imf) && imf > 0) {
      return (1 / imf).toString()
    }
    return '0'
  }

  private precisionFromStep(step?: string): number {
    if (!step) {
      return 0
    }
    const normalized = step.trim()
    if (normalized === '') {
      return 0
    }
    const expMatch = normalized.match(/e(-?)(\d+)$/i)
    if (expMatch) {
      const [, sign, digits] = expMatch
      const exponent = Number(digits)
      if (Number.isFinite(exponent)) {
        return sign === '-' ? Math.abs(exponent) : 0
      }
    }
    const [, decimals] = normalized.split('.')
    if (!decimals) {
      return 0
    }
    return decimals.replace(/0+$/, '').length
  }

  private ensureError(error: unknown): Error {
    if (error instanceof Error) {
      return error
    }
    return new Error(String(error))
  }
}
