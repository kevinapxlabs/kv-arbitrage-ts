import { BackpackAccountApi, BackpackTradingApi, BackpackSide } from '../libs/backpack/index.js'
import { blogger } from '../common/base/logger.js'
import { ExchangeRuntimeConfig } from '../config/config.js'
import { ExecutionRequest, ExecutionReport, ExchangeId, ExchangeType } from './types.js'
import { TokenConfig } from './types.js'
import { ExchangeAdapter } from './exchange-adapter.js'

const DEFAULT_SETTLEMENT = 'USDC'

// Backpack 交易所的下单适配器
export class BackpackExchangeAdapter implements ExchangeAdapter {
  readonly id: ExchangeId
  readonly type: ExchangeType = 'backpack'
  readonly settlementAsset: string
  private readonly tradingApi: BackpackTradingApi
  private readonly accountApi: BackpackAccountApi
  private leverageConfigured = false
  private readonly takerFeeBps: number

  constructor(private readonly config: ExchangeRuntimeConfig) {
    if (!config.apiKey || !config.apiSecret) {
      blogger.warn('backpack adapter initialized without api credentials, trading disabled')
    }
    this.id = config.id
    this.tradingApi = new BackpackTradingApi({
      apiKey: config.apiKey,
      privateKey: config.apiSecret
    })
    this.accountApi = new BackpackAccountApi({
      apiKey: config.apiKey,
      privateKey: config.apiSecret
    })
    this.settlementAsset = config.settlementAsset ?? DEFAULT_SETTLEMENT
    this.takerFeeBps = config.fees?.takerBps ?? 0
  }

  // 初始化交易所连接，当前仅预留接口
  async setup(): Promise<void> {
    // leverage setup deferred
  }

  // 设置账户默认杠杆，避免重复调用
  async ensureLeverage(symbol: string, leverage: number): Promise<void> {
    if (this.leverageConfigured) {
      return
    }
    try {
      await this.accountApi.updateAccountSettings({ leverageLimit: leverage.toString() })
      this.leverageConfigured = true
    } catch (error) {
      blogger.error('backpack leverage setup failed', symbol, error)
    }
  }

  // 校验下单数量是否达到最小交易量
  normalizeQuantity(symbol: string, quantity: number, token: TokenConfig): number {
    const minSize = token.minTradeSize ?? 0
    if (quantity < minSize) {
      return minSize
    }
    return quantity
  }

  // 下达市价单并返回执行结果
  async placeMarketOrder(request: ExecutionRequest, token: TokenConfig): Promise<ExecutionReport> {
    try {
      const reduceOnly = request.reason !== 'OPEN'
      const response = await this.tradingApi.submitOrder({
        symbol: request.symbol,
        side: this.toSide(request.side),
        orderType: 'Market',
        quantity: request.quantity.toString(),
        reduceOnly
      })

      const executedQuantity = Number(response.executedQuantity ?? response.quantity ?? 0)
      const executedQuote = Number(response.executedQuoteQuantity ?? 0)
      const avgPrice = executedQuantity > 0 ? executedQuote / executedQuantity : 0
      const feePaid = Math.abs(executedQuote * (this.takerFeeBps / 10000))
      const success = executedQuantity > 0

      return {
        success,
        exchangeId: this.id,
        symbol: request.symbol,
        side: request.side,
        requestedQuantity: request.quantity,
        filledQuantity: executedQuantity,
        averagePrice: avgPrice,
        feePaid,
        timestamp: Date.now(),
        referenceId: request.referenceId,
        raw: response,
        error: success ? undefined : 'no fills returned'
      }
    } catch (error: any) {
      const message = error?.message ?? 'backpack order failed'
      blogger.error('backpack order failed', message)
      return {
        success: false,
        exchangeId: this.id,
        symbol: request.symbol,
        side: request.side,
        requestedQuantity: request.quantity,
        filledQuantity: 0,
        averagePrice: 0,
        feePaid: 0,
        timestamp: Date.now(),
        referenceId: request.referenceId,
        error: message
      }
    }
  }

  // 将内部方向转换为 Backpack 所需的枚举
  private toSide(side: string): BackpackSide {
    return side === 'SELL' ? 'Ask' : 'Bid'
  }
}
