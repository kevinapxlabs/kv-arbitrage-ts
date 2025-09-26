import {
  BackpackBatchCommandOrderResult,
  BackpackFuturePositionWithMargin,
  BackpackOrder,
  BackpackOrderCancelAllPayload,
  BackpackOrderCancelPayload,
  BackpackOrderExecutePayload,
  BackpackOrderType,
  BackpackQuote,
  BackpackQuoteAcceptPayload,
  BackpackQuotePayload,
  BackpackRequestForQuote,
  BackpackRequestForQuoteCancelPayload,
  BackpackRequestForQuotePayload,
  BackpackRequestForQuoteRefreshPayload,
  BackpackStrategy,
  BackpackStrategyCancelAllPayload,
  BackpackStrategyCancelPayload,
  BackpackStrategyCreatePayload,
  BackpackStrategyType,
} from './backpack.types';
import {
  BackpackOrderQuery as BackpackOrderQueryParams,
  BackpackOrdersQuery,
  BackpackPositionQuery,
  BackpackStrategyQuery,
  BackpackStrategiesQuery,
} from './backpack.interfaces';
import { BackpackApiBase } from './backpack.client';

export class BackpackTradingApi extends BackpackApiBase {
  async submitOrder(payload: BackpackOrderExecutePayload): Promise<BackpackOrderType> {
    return this.postSigned<BackpackOrderType>('/api/v1/order', payload);
  }

  async submitBatchOrders(payload: BackpackOrderExecutePayload[]): Promise<BackpackBatchCommandOrderResult[]> {
    return this.postSigned<BackpackBatchCommandOrderResult[]>('/api/v1/orders', payload);
  }

  async getOrder(params: BackpackOrderQueryParams): Promise<BackpackOrder> {
    return this.getSigned<BackpackOrder>('/api/v1/order', params);
  }

  async getOpenOrders(params?: BackpackOrdersQuery): Promise<BackpackOrderType[]> {
    return this.getSigned<BackpackOrderType[]>('/api/v1/orders', params);
  }

  async cancelOrder(payload: BackpackOrderCancelPayload): Promise<BackpackOrderType> {
    return this.deleteSigned<BackpackOrderType>('/api/v1/order', payload);
  }

  async cancelAllOrders(payload: BackpackOrderCancelAllPayload): Promise<BackpackOrderType[]> {
    return this.deleteSigned<BackpackOrderType[]>('/api/v1/orders', payload);
  }

  async getPositions(params?: BackpackPositionQuery): Promise<BackpackFuturePositionWithMargin[]> {
    return this.getSigned<BackpackFuturePositionWithMargin[]>('/api/v1/position', params);
  }

  async submitRequestForQuote(payload: BackpackRequestForQuotePayload): Promise<BackpackRequestForQuote> {
    return this.postSigned<BackpackRequestForQuote>('/api/v1/rfq', payload);
  }

  async refreshRequestForQuote(payload: BackpackRequestForQuoteRefreshPayload): Promise<BackpackRequestForQuote> {
    return this.postSigned<BackpackRequestForQuote>('/api/v1/rfq/refresh', payload);
  }

  async cancelRequestForQuote(payload: BackpackRequestForQuoteCancelPayload): Promise<BackpackRequestForQuote> {
    return this.postSigned<BackpackRequestForQuote>('/api/v1/rfq/cancel', payload);
  }

  async submitQuote(payload: BackpackQuotePayload): Promise<BackpackQuote> {
    return this.postSigned<BackpackQuote>('/api/v1/rfq/quote', payload);
  }

  async acceptQuote(payload: BackpackQuoteAcceptPayload): Promise<BackpackQuote> {
    return this.postSigned<BackpackQuote>('/api/v1/rfq/accept', payload);
  }

  async getStrategy(params: BackpackStrategyQuery): Promise<BackpackStrategy> {
    return this.getSigned<BackpackStrategy>('/api/v1/strategy', params);
  }

  async createStrategy(payload: BackpackStrategyCreatePayload): Promise<BackpackStrategy> {
    return this.postSigned<BackpackStrategy>('/api/v1/strategy', payload);
  }

  async cancelStrategy(payload: BackpackStrategyCancelPayload): Promise<BackpackStrategy> {
    return this.deleteSigned<BackpackStrategy>('/api/v1/strategy', payload);
  }

  async getStrategies(params?: BackpackStrategiesQuery): Promise<BackpackStrategy[]> {
    return this.getSigned<BackpackStrategy[]>('/api/v1/strategies', params);
  }

  async cancelAllStrategies(payload: BackpackStrategyCancelAllPayload): Promise<BackpackStrategyType[]> {
    return this.deleteSigned<BackpackStrategyType[]>('/api/v1/strategies', payload);
  }
}
