import { blogger } from '../common/base/logger.js'
import { EExchange, EExchangeId, EKVSide } from '../common/exchange.enum.js'
import type { TQtyFilter } from '../manager/marketinfo/maretinfo.type.js'
import type { ExchangeAdapter } from './exchange-adapter.js'
import type { TAccountInfo, TCancelOrder, TKVPosition, TQueryOrder } from './types.js'
import {
  BackpackAccountApi,
  BackpackPublicApi,
  BackpackTradingApi
} from '../libs/backpack/index.js'
import type {
  BackpackFuturePositionWithMargin,
  BackpackMarket,
  BackpackOrderStatus
} from '../libs/backpack/backpack.types.js'
import { BackpackMarketInfoMgr } from '../manager/marketinfo/backpack.marketinfo.js'

const DEFAULT_SETTLEMENT = 'USDC'
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
  readonly id = EExchangeId.Backpack
  readonly exchangeName = EExchange.Backpack
  readonly settlementAsset = 'USDC'

  private readonly accountApi: BackpackAccountApi
  private readonly tradingApi: BackpackTradingApi
  private leverageConfigured = false

  constructor(apiKey: string, apiSecret: string) {
    this.accountApi = new BackpackAccountApi({
      apiKey: apiKey,
      privateKey: apiSecret
    })
    this.tradingApi = new BackpackTradingApi({
      apiKey: apiKey,
      privateKey: apiSecret
    })
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
    try {
      const summary = await this.accountApi.getMarginSummary()
      return {
        totalNetEquity: summary.netEquity,
        totalPositiveNotional: summary.netExposureFutures ?? '0',
        bnAccountInfo: null,
        bybitAccountInfo: null,
        bitgetAccountInfo: null,
        ltpBNAccountInfo: null
      }
    } catch (error) {
      blogger.error('backpack getAccountInfo failed', error)
      throw this.ensureError(error)
    }
  }

  async getPositions(): Promise<TKVPosition[]> {
    try {
      const positions = await this.tradingApi.getPositions()
      return positions
        .filter((position) => Number(position.netQuantity) !== 0)
        .map((position) => this.toKVPosition(position))
    } catch (error) {
      blogger.error('backpack getPositions failed', error)
      throw this.ensureError(error)
    }
  }

  async ensureLeverage(symbol: string, leverage: number): Promise<void> {
    if (this.leverageConfigured) {
      return
    }
    try {
      await this.accountApi.updateAccountSettings({ leverageLimit: leverage.toString() })
      this.leverageConfigured = true
    } catch (error) {
      blogger.error('backpack ensureLeverage failed', { symbol, leverage, error })
      throw this.ensureError(error)
    }
  }

  async getQtyFilter(symbol: string): Promise<TQtyFilter | undefined> {
    const normalized = this.normalizeSymbol(symbol)
    try {
      const rule = await BackpackMarketInfoMgr.getFutureSymbolRule(symbol)
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
    try {
      const response = await this.tradingApi.submitOrder({
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
    try {
      const response = await this.tradingApi.submitOrder({
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
    try {
      const response = await this.tradingApi.getOrder({ symbol, ...identifier })
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
    try {
      const response = await this.tradingApi.cancelOrder({ symbol, ...identifier })
      return { orderId: response.id ?? orderId }
    } catch (error) {
      blogger.error('backpack cancelOrder failed', { symbol, orderId, error })
      throw this.ensureError(error)
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
