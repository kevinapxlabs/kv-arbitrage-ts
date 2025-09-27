import { blogger } from '../common/base/logger.js'
import { EExchange, EExchangeId, EKVSide } from '../common/exchange.enum.js'
import type { TQtyFilter } from '../manager/marketinfo/maretinfo.type.js'
import type { ExchangeAdapter } from './exchange-adapter.js'
import type { TAccountInfo, TCancelOrder, TKVPosition, TQueryOrder } from './types.js'
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
  readonly id = EExchangeId.Aster
  readonly exchangeName = EExchange.Aster
  readonly settlementAsset = 'USDT'

  private readonly accountApi: AsterAccountApi

  constructor(apiKey: string, apiSecret: string) {
    this.accountApi = new AsterAccountApi({
      apiKey: apiKey,
      apiSecret: apiSecret
    })
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
    try {
      const account = await this.accountApi.getAccountInfo()
      return {
        totalNetEquity: account.totalMarginBalance,
        totalPositiveNotional: account.totalPositionInitialMargin,
        bnAccountInfo: null,
        bybitAccountInfo: null,
        bitgetAccountInfo: null,
        ltpBNAccountInfo: null
      }
    } catch (error) {
      blogger.error('aster getAccountInfo failed', error)
      throw this.ensureError(error)
    }
  }

  async getPositions(): Promise<TKVPosition[]> {
    try {
      const account = await this.accountApi.getAccountInfo()
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
    try {
      await this.accountApi.setLeverage({ symbol, leverage })
    } catch (error) {
      blogger.error('aster ensureLeverage failed', { symbol, leverage, error })
      throw this.ensureError(error)
    }
  }

  async getQtyFilter(symbol: string): Promise<TQtyFilter | undefined> {
    const normalized = this.normalizePair(symbol)
    try {
      const rule = await AsterMarketInfoMgr.getFutureSymbolRule(symbol)
      if (!rule) {
        return undefined
      }
      return rule
    } catch (error) {
      blogger.error('aster load exchange info failed', error)
      return undefined
    }
  }

  async placeMarketOrder(symbol: string, side: EKVSide, quantity: string): Promise<string> {
    try {
      const response = await this.accountApi.createOrder({
        symbol,
        side: this.toOrderSide(side),
        type: AsterOrderType.MARKET,
        quantity,
        positionSide: AsterPositionSide.BOTH,
        newOrderRespType: AsterNewOrderRespType.RESULT
      })
      return String(response.orderId)
    } catch (error) {
      blogger.error('aster placeMarketOrder failed', { symbol, side, quantity, error })
      throw this.ensureError(error)
    }
  }

  async placeLimitOrder(symbol: string, side: EKVSide, quantity: string, price: string): Promise<string> {
    try {
      const response = await this.accountApi.createOrder({
        symbol,
        side: this.toOrderSide(side),
        type: AsterOrderType.LIMIT,
        quantity,
        price,
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
    try {
      const response = await this.accountApi.queryOrder({ symbol, ...identifier })
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
    try {
      const response = await this.accountApi.cancelOrder({ symbol, ...identifier })
      return { orderId: String(response.orderId ?? orderId) }
    } catch (error) {
      blogger.error('aster cancelOrder failed', { symbol, orderId, error })
      throw this.ensureError(error)
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
