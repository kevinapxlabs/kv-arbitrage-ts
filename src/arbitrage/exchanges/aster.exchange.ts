import { AsterAccountApi, AsterOrderSide, AsterOrderType, AsterPositionSide, AsterNewOrderRespType, AsterOrderStatus } from '../../libs/aster/index.js'
import { blogger } from '../../common/base/logger.js'
import { ExchangeRuntimeConfig } from '../../config/config.js'
import { ExecutionRequest, ExecutionReport, ExchangeId, ExchangeType } from '../types.js'
import { TokenConfig } from '../types.js'
import { ExchangeAdapter } from './exchange-adapter.js'

const DEFAULT_SETTLEMENT = 'USDT'

// Aster 交易所的下单适配器
export class AsterExchangeAdapter implements ExchangeAdapter {
  readonly id: ExchangeId
  readonly type: ExchangeType = 'aster'
  readonly settlementAsset: string
  private readonly accountApi: AsterAccountApi
  private readonly leveragedSymbols = new Set<string>()
  private readonly takerFeeBps: number

  constructor(private readonly config: ExchangeRuntimeConfig) {
    if (!config.apiKey || !config.apiSecret) {
      blogger.warn('aster adapter initialized without api credentials, trading disabled')
    }
    this.id = config.id
    this.accountApi = new AsterAccountApi({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret
    })
    this.settlementAsset = config.settlementAsset ?? DEFAULT_SETTLEMENT
    this.takerFeeBps = config.fees?.takerBps ?? 0
  }

  // 初始化交易所连接，当前仅预留接口
  async setup(): Promise<void> {
    // leverage will be set lazily per symbol
  }

  // 确保目标合约杠杆设置为配置要求
  async ensureLeverage(symbol: string, leverage: number): Promise<void> {
    if (this.leveragedSymbols.has(symbol)) {
      return
    }
    try {
      await this.accountApi.setLeverage({ symbol, leverage })
      this.leveragedSymbols.add(symbol)
    } catch (error) {
      blogger.error('aster leverage setup failed', symbol, error)
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
      const response = await this.accountApi.createOrder({
        symbol: request.symbol,
        side: this.toOrderSide(request.side),
        type: AsterOrderType.MARKET,
        quantity: request.quantity.toString(),
        reduceOnly,
        positionSide: AsterPositionSide.BOTH,
        newOrderRespType: AsterNewOrderRespType.RESULT
      })

      const filledQty = Number(response.executedQty ?? response.origQty ?? 0)
      const avgPrice = Number(response.avgPrice ?? response.price ?? 0)
      const notional = filledQty * avgPrice
      const feePaid = Math.abs(notional * (this.takerFeeBps / 10000))
      const success = response.status === AsterOrderStatus.FILLED || filledQty > 0

      return {
        success,
        exchangeId: this.id,
        symbol: request.symbol,
        side: request.side,
        requestedQuantity: request.quantity,
        filledQuantity: filledQty,
        averagePrice: avgPrice,
        feePaid,
        timestamp: Date.now(),
        referenceId: request.referenceId,
        raw: response,
        error: success ? undefined : `order status ${response.status}`
      }
    } catch (error: any) {
      const message = error?.message ?? 'aster order failed'
      blogger.error('aster order failed', message)
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

  // 将内部方向转换为 Aster 所需的枚举
  private toOrderSide(side: string): AsterOrderSide {
    return side === 'SELL' ? AsterOrderSide.SELL : AsterOrderSide.BUY
  }
}
