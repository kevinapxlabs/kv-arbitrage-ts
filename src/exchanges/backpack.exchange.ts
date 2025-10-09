import BigNumber from 'bignumber.js'
import { blogger } from '../common/base/logger.js'
import { EExchange, EExchangeCexId, EExchangeId, EKVSide } from '../common/exchange.enum.js'
import type { TQtyFilter } from '../manager/marketinfo/maretinfo.type.js'
import type { ExchangeAdapter } from './exchange.adapter.js'
import type { TAccountInfo, TBackpackAccountInfo, TBNKey, TCancelOrder, TKVFundingFee, TKVPosition, TQueryOrder } from './types.js'
import { BackpackMarketInfoMgr } from '../manager/marketinfo/backpack.marketinfo.js'
import { TArbitrageConfig } from '../arbitrage/arbitrage.config.js'
import { defiConfig } from '../config/config.js'
import { getKeyInfo } from '../utils/bnKey.js'
import { EPositionDescrease } from '../common/types/exchange.type.js'
import { TRiskDataInfo } from '../arbitrage/type.js'
import { ExchangeDataMgr } from '../arbitrage/exchange.data.js'
import { BpxApiClient, FuturePositionWithMargin, OrderStatus, OrderType, Side, TimeInForce } from '../libs/bpxClient/index.js'
import { IncreasePositionDiscount } from './constant.js'
import { DEFAULT_LEVERAGE } from '../arbitrage/arbitrage.constant.js'

const COMPLETED_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.Cancelled,
  OrderStatus.Expired,
  OrderStatus.Filled,
  OrderStatus.TriggerFailed
])

interface BackpackOrderIdentifier {
  orderId?: string
  clientId?: number
}

export class BackpackExchangeAdapter implements ExchangeAdapter {
  readonly traceId: string
  readonly exchangeId = EExchangeId.BackPack
  readonly cexId = EExchangeCexId.BackPack
  readonly exchangeName = EExchange.Backpack
  readonly settlementAsset = 'USDC'

  readonly SUCCESS_STATUS_CODE = 200

  readonly arbitrageConfig: TArbitrageConfig

  constructor(traceId: string, arbitrageConfig: TArbitrageConfig) {
    this.traceId = traceId
    this.arbitrageConfig = arbitrageConfig
  }

  isIncrease(riskData: TRiskDataInfo): boolean {
    const bpAcc = riskData.accountInfo.bpAccountInfo
    if (!bpAcc) {
      return false
    }
    const bpMarginFraction = bpAcc.marginFraction
    const bpInitialMarginFraction = bpAcc.imf
    const increaseCheck = bpMarginFraction < this.arbitrageConfig.BP_MARGIN_RATIO_1
          && bpInitialMarginFraction < IncreasePositionDiscount
    return increaseCheck
  }

  isDecrease(riskData: TRiskDataInfo): EPositionDescrease {
    const bpAcc = riskData.accountInfo.bpAccountInfo
    if (!bpAcc) {
      return EPositionDescrease.None
    }
    const bpMarginFraction = bpAcc.marginFraction
    if (bpMarginFraction > this.arbitrageConfig.BP_MARGIN_RATIO_3) {
      return EPositionDescrease.DecreasePercent
    } else if (bpMarginFraction > this.arbitrageConfig.BP_MARGIN_RATIO_2) {
      return EPositionDescrease.Decrease
    }
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
    const accountApi = new BpxApiClient({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      const collateral = await accountApi.capital.getCollateral()
      const backpackCollateral = collateral.data
      const imf = backpackCollateral.imf
      const mmf = backpackCollateral.mmf
      const marginFraction = backpackCollateral.marginFraction
      const netEquity = backpackCollateral.netEquity
      const bpAccountInfo: TBackpackAccountInfo = {
        imf: parseFloat(imf),
        mmf: parseFloat(mmf),
        marginFraction: parseFloat(marginFraction ?? '0'),
        equity: parseFloat(netEquity),
      }
      
      return {
        totalNetEquity: collateral.data.netEquity,
        totalPositiveNotional: collateral.data.netExposureFutures ?? '0',
        bpAccountInfo: bpAccountInfo,
        asterAccountInfo: null
      }
    } catch (error) {
      blogger.error('backpack getAccountInfo failed', error)
      throw this.ensureError(error)
    }
  }

  async getPositions(): Promise<TKVPosition[]> {
    const keyInfo = this.getKeyInfo()
    const tradingApi = new BpxApiClient({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      const positions = await tradingApi.futures.getOpenPositions()
      if (positions.statusCode !== this.SUCCESS_STATUS_CODE) {
        throw new Error(`bp getPositions failed, statusCode: ${positions.statusCode}, message: ${positions.error}`)
      }
      return positions.data
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
      return await BackpackMarketInfoMgr.getFutureSymbolRule(normalized)
    } catch (error) {
      console.debug(error);
      blogger.error('backpack load markets failed', error)
      return undefined
    }
  }

  async placeMarketOrder(symbol: string, side: EKVSide, quantity: string, reduceOnly: boolean): Promise<string> {
    const keyInfo = this.getKeyInfo()
    const tradingApi = new BpxApiClient({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      const response = await tradingApi.order.executeOrder({
        symbol,
        side: this.toOrderSide(side) as Side,
        orderType: OrderType.Market,
        quantity,
        reduceOnly,
        timeInForce: TimeInForce.GTC
      })
      if (response.statusCode !== this.SUCCESS_STATUS_CODE) {
        throw new Error(`bp placeMarketOrder failed, statusCode: ${response.statusCode}, message: ${response.error}`)
      }
      return response.data.id
    } catch (error) {
      blogger.error('backpack placeMarketOrder failed', { symbol, side, quantity, error })
      throw this.ensureError(error)
    }
  }

  async placeLimitOrder(symbol: string, side: EKVSide, quantity: string, price: string, reduceOnly: boolean): Promise<string> {
    const keyInfo = this.getKeyInfo()
    const tradingApi = new BpxApiClient({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      const response = await tradingApi.order.executeOrder({
        symbol,
        side: this.toOrderSide(side) as Side,
        orderType: OrderType.Limit,
        quantity,
        price,
        reduceOnly,
        timeInForce: TimeInForce.GTC
      })
      if (response.statusCode !== this.SUCCESS_STATUS_CODE) {
        throw new Error(`bp placeLimitOrder failed, statusCode: ${response.statusCode}, message: ${response.error}`)
      }
      return response.data.id
    } catch (error) {
      blogger.error('backpack placeLimitOrder failed', { symbol, side, quantity, price, error })
      throw this.ensureError(error)
    }
  }

  async queryOrder(symbol: string, orderId: string): Promise<TQueryOrder> {
    const keyInfo = this.getKeyInfo()
    const tradingApi = new BpxApiClient({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    const params = {
      symbol,
      orderId
    }
    try {
      const response = await tradingApi.order.getOpenOrder(params)
      if (response.statusCode === 404 && response.error.code === 'RESOURCE_NOT_FOUND') {
        return {
          isCompleted: true,
          result: null
        }
      }
      if (response.statusCode !== this.SUCCESS_STATUS_CODE) {
        throw new Error(`bp queryOrder failed, statusCode: ${response.statusCode}, message: ${response.error}`)
      }
      return {
        isCompleted: COMPLETED_ORDER_STATUSES.has(response.data.status),
        result: response
      }
    } catch (error) {
      blogger.error('backpack queryOrder failed', { symbol, orderId, error })
      throw this.ensureError(error)
    }
  }

  async cancelOrder(symbol: string, orderId: string): Promise<TCancelOrder> {
    const keyInfo = this.getKeyInfo()
    const tradingApi = new BpxApiClient({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    const params = {
      symbol,
      orderId
    }
    try {
      const response = await tradingApi.order.cancelOpenOrder(params)
      if (response.statusCode !== this.SUCCESS_STATUS_CODE) {
        throw new Error(`bp cancelOrder failed, statusCode: ${response.statusCode}, message: ${response.error}`)
      }
      return { orderId: response.data.id }
    } catch (error) {
      blogger.error('bp cancelOrder failed', { symbol, orderId, error })
      throw this.ensureError(error)
    }
  }

  async getCurrentFundingFee(symbol: string): Promise<TKVFundingFee> {
    const fundingFee = await ExchangeDataMgr.getFundingFee(EExchange.Backpack, symbol)
    return fundingFee ? { fundingFee: BigNumber(fundingFee.fundingFee), nextFundingTime: fundingFee.nextFundingTime } : { fundingFee: BigNumber(0), nextFundingTime: 0 }
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

  private toKVPosition(position: FuturePositionWithMargin): TKVPosition {
    return {
      exchangeName: this.exchangeName,
      symbol: position.symbol,
      exchangeToken: this.getExchangeToken(position.symbol),
      leverage: DEFAULT_LEVERAGE.toString(),
      positionAmt: position.netQuantity,
      notional: position.netExposureNotional
    }
  }

  private ensureError(error: unknown): Error {
    if (error instanceof Error) {
      return error
    }
    return new Error(String(error))
  }
}
