import { AsterApiBase, AsterClientConfig } from './aster.client';
import {
  AsterAccountBalanceEntry,
  AsterAccountInfoResponse,
  AsterAdlQuantileEntry,
  AsterAdlQuantileQuery,
  AsterAllOrdersQuery,
  AsterBatchCancelOrderRequest,
  AsterBatchOrderResponse,
  AsterBatchOrdersRequest,
  AsterCancelAllOpenOrdersRequest,
  AsterCancelAllOpenOrdersResponse,
  AsterCancelOrderRequest,
  AsterCancelOrderResponse,
  AsterCommissionRate,
  AsterCommissionRateQuery,
  AsterCountdownCancelRequest,
  AsterCountdownCancelResponse,
  AsterCreateOrderResponse,
  AsterForceOrder,
  AsterForceOrdersQuery,
  AsterGenericResponse,
  AsterGetOpenOrderRequest,
  AsterIncomeQuery,
  AsterIncomeRecord,
  AsterLeverageBracketQuery,
  AsterLeverageBracketResponse,
  AsterLeverageRequest,
  AsterLeverageResponse,
  AsterListenKeyResponse,
  AsterMarginTypeRequest,
  AsterMarginTypeResponse,
  AsterMultiAssetsMarginRequest,
  AsterMultiAssetsMarginResponse,
  AsterNewOrderRequest,
  AsterOrderBase,
  AsterOpenOrdersQuery,
  AsterPositionMarginHistoryEntry,
  AsterPositionMarginHistoryQuery,
  AsterPositionMarginRequest,
  AsterPositionMarginResponse,
  AsterPositionRisk,
  AsterPositionSideDualRequest,
  AsterPositionSideDualResponse,
  AsterQueryOrderRequest,
  AsterQueryOrderResponse,
  AsterTestOrderResponse,
  AsterUserTrade,
  AsterUserTradesQuery,
  AsterWalletTransferRequest,
  AsterWalletTransferResponse,
} from './aster.types';

export class AsterAccountApi extends AsterApiBase {
  constructor(config: AsterClientConfig = {}) {
    super(config);
  }

  async setPositionMode(request: AsterPositionSideDualRequest): Promise<AsterGenericResponse> {
    const params = this.attachRecvWindow(
      {
        dualSidePosition: request.dualSidePosition ? 'true' : 'false',
      },
      request.recvWindow
    );
    return this.postSigned<AsterGenericResponse>('/fapi/v1/positionSide/dual', params);
  }

  async getPositionMode(request: { recvWindow?: number } = {}): Promise<AsterPositionSideDualResponse> {
    const params = this.attachRecvWindow({}, request.recvWindow);
    return this.getSigned<AsterPositionSideDualResponse>('/fapi/v1/positionSide/dual', params);
  }

  async setMultiAssetsMargin(request: AsterMultiAssetsMarginRequest): Promise<AsterGenericResponse> {
    const params = this.attachRecvWindow(
      {
        multiAssetsMargin: request.multiAssetsMargin ? 'true' : 'false',
      },
      request.recvWindow
    );
    return this.postSigned<AsterGenericResponse>('/fapi/v1/multiAssetsMargin', params);
  }

  async getMultiAssetsMargin(request: { recvWindow?: number } = {}): Promise<AsterMultiAssetsMarginResponse> {
    const params = this.attachRecvWindow({}, request.recvWindow);
    return this.getSigned<AsterMultiAssetsMarginResponse>('/fapi/v1/multiAssetsMargin', params);
  }

  async createOrder(request: AsterNewOrderRequest): Promise<AsterCreateOrderResponse> {
    const params = this.buildOrderParams(request);
    return this.postSigned<AsterCreateOrderResponse>('/fapi/v1/order', params);
  }

  async testOrder(request: AsterNewOrderRequest): Promise<AsterTestOrderResponse> {
    const params = this.buildOrderParams(request);
    return this.postSigned<AsterTestOrderResponse>('/fapi/v1/order/test', params);
  }

  async createBatchOrders(request: AsterBatchOrdersRequest): Promise<AsterBatchOrderResponse> {
    const { recvWindow, orders } = request;
    const batchPayload = orders.map((order) => this.buildOrderParams(order, false));
    const params: Record<string, unknown> = {
      batchOrders: JSON.stringify(batchPayload),
    };
    if (recvWindow !== undefined) {
      params.recvWindow = recvWindow;
    }
    return this.postSigned<AsterBatchOrderResponse>('/fapi/v1/batchOrders', params);
  }

  async walletTransfer(request: AsterWalletTransferRequest): Promise<AsterWalletTransferResponse> {
    const { recvWindow, ...rest } = request;
    const params: Record<string, unknown> = { ...rest };
    if (recvWindow !== undefined) {
      params.recvWindow = recvWindow;
    }
    return this.postSigned<AsterWalletTransferResponse>('/fapi/v1/asset/wallet/transfer', params);
  }

  async cancelOrder(request: AsterCancelOrderRequest): Promise<AsterCancelOrderResponse> {
    const params = this.attachRecvWindow({
      symbol: request.symbol,
      orderId: request.orderId,
      origClientOrderId: request.origClientOrderId,
    }, request.recvWindow);
    return this.deleteSigned<AsterCancelOrderResponse>('/fapi/v1/order', params);
  }

  async cancelAllOpenOrders(
    request: AsterCancelAllOpenOrdersRequest
  ): Promise<AsterCancelAllOpenOrdersResponse> {
    const params = this.attachRecvWindow({ symbol: request.symbol }, request.recvWindow);
    return this.deleteSigned<AsterCancelAllOpenOrdersResponse>('/fapi/v1/allOpenOrders', params);
  }

  async cancelBatchOrders(request: AsterBatchCancelOrderRequest): Promise<AsterBatchOrderResponse> {
    const { recvWindow, symbol, orderIdList, origClientOrderIdList } = request;
    const params: Record<string, unknown> = { symbol };
    if (orderIdList) {
      params.orderIdList = JSON.stringify(orderIdList);
    }
    if (origClientOrderIdList) {
      params.origClientOrderIdList = JSON.stringify(origClientOrderIdList);
    }
    if (recvWindow !== undefined) {
      params.recvWindow = recvWindow;
    }
    return this.deleteSigned<AsterBatchOrderResponse>('/fapi/v1/batchOrders', params);
  }

  async countdownCancelAll(request: AsterCountdownCancelRequest): Promise<AsterCountdownCancelResponse> {
    const params = this.attachRecvWindow(
      { symbol: request.symbol, countdownTime: request.countdownTime },
      request.recvWindow
    );
    return this.postSigned<AsterCountdownCancelResponse>('/fapi/v1/countdownCancelAll', params);
  }

  async queryOrder(request: AsterQueryOrderRequest): Promise<AsterQueryOrderResponse> {
    const params = this.attachRecvWindow(
      {
        symbol: request.symbol,
        orderId: request.orderId,
        origClientOrderId: request.origClientOrderId,
      },
      request.recvWindow
    );
    return this.getSigned<AsterQueryOrderResponse>('/fapi/v1/order', params);
  }

  async getOpenOrder(request: AsterGetOpenOrderRequest): Promise<AsterOrderBase> {
    const params = this.attachRecvWindow(
      {
        symbol: request.symbol,
        orderId: request.orderId,
        origClientOrderId: request.origClientOrderId,
      },
      request.recvWindow
    );
    return this.getSigned<AsterOrderBase>('/fapi/v1/openOrder', params);
  }

  async getOpenOrders(request: AsterOpenOrdersQuery = {}): Promise<AsterOrderBase[]> {
    const params = this.attachRecvWindow(
      { symbol: request.symbol },
      request.recvWindow
    );
    return this.getSigned<AsterOrderBase[]>('/fapi/v1/openOrders', params);
  }

  async getAllOrders(request: AsterAllOrdersQuery): Promise<AsterOrderBase[]> {
    const params = this.attachRecvWindow(
      {
        symbol: request.symbol,
        orderId: request.orderId,
        startTime: request.startTime,
        endTime: request.endTime,
        limit: request.limit,
      },
      request.recvWindow
    );
    return this.getSigned<AsterOrderBase[]>('/fapi/v1/allOrders', params);
  }

  async getBalance(request: { recvWindow?: number } = {}): Promise<AsterAccountBalanceEntry[]> {
    const params = this.attachRecvWindow({}, request.recvWindow);
    return this.getSigned<AsterAccountBalanceEntry[]>('/fapi/v2/balance', params);
  }

  async getAccountInfo(request: { recvWindow?: number } = {}): Promise<AsterAccountInfoResponse> {
    const params = this.attachRecvWindow({}, request.recvWindow);
    return this.getSigned<AsterAccountInfoResponse>('/fapi/v4/account', params);
  }

  async getPositionRisk(request: { recvWindow?: number } = {}): Promise<AsterPositionRisk[]> {
    const params = this.attachRecvWindow({}, request.recvWindow);
    return this.getSigned<AsterPositionRisk[]>('/fapi/v2/positionRisk', params);
  }

  async setLeverage(request: AsterLeverageRequest): Promise<AsterLeverageResponse> {
    const params = this.attachRecvWindow(
      {
        symbol: request.symbol,
        leverage: request.leverage,
      },
      request.recvWindow
    );
    return this.postSigned<AsterLeverageResponse>('/fapi/v1/leverage', params);
  }

  async setMarginType(request: AsterMarginTypeRequest): Promise<AsterMarginTypeResponse> {
    const params = this.attachRecvWindow(
      {
        symbol: request.symbol,
        marginType: request.marginType,
      },
      request.recvWindow
    );
    return this.postSigned<AsterMarginTypeResponse>('/fapi/v1/marginType', params);
  }

  async adjustPositionMargin(request: AsterPositionMarginRequest): Promise<AsterPositionMarginResponse> {
    const params = this.attachRecvWindow(
      {
        symbol: request.symbol,
        amount: request.amount,
        type: request.type,
        positionSide: request.positionSide,
      },
      request.recvWindow
    );
    return this.postSigned<AsterPositionMarginResponse>('/fapi/v1/positionMargin', params);
  }

  async getPositionMarginHistory(
    request: AsterPositionMarginHistoryQuery
  ): Promise<AsterPositionMarginHistoryEntry[]> {
    const params = this.attachRecvWindow(
      {
        symbol: request.symbol,
        type: request.type,
        startTime: request.startTime,
        endTime: request.endTime,
        limit: request.limit,
      },
      request.recvWindow
    );
    return this.getSigned<AsterPositionMarginHistoryEntry[]>('/fapi/v1/positionMargin/history', params);
  }

  async getUserTrades(request: AsterUserTradesQuery): Promise<AsterUserTrade[]> {
    const params = this.attachRecvWindow(
      {
        symbol: request.symbol,
        startTime: request.startTime,
        endTime: request.endTime,
        fromId: request.fromId,
        limit: request.limit,
      },
      request.recvWindow
    );
    return this.getSigned<AsterUserTrade[]>('/fapi/v1/userTrades', params);
  }

  async getIncomeHistory(request: AsterIncomeQuery = {}): Promise<AsterIncomeRecord[]> {
    const params = this.attachRecvWindow(
      {
        symbol: request.symbol,
        incomeType: request.incomeType,
        startTime: request.startTime,
        endTime: request.endTime,
        limit: request.limit,
      },
      request.recvWindow
    );
    return this.getSigned<AsterIncomeRecord[]>('/fapi/v1/income', params);
  }

  async getLeverageBracket(
    request: AsterLeverageBracketQuery = {}
  ): Promise<AsterLeverageBracketResponse> {
    const params = this.attachRecvWindow({ symbol: request.symbol }, request.recvWindow);
    return this.getSigned<AsterLeverageBracketResponse>('/fapi/v1/leverageBracket', params);
  }

  async getAdlQuantile(request: AsterAdlQuantileQuery = {}): Promise<AsterAdlQuantileEntry[]> {
    const params = this.attachRecvWindow({ symbol: request.symbol }, request.recvWindow);
    return this.getSigned<AsterAdlQuantileEntry[]>('/fapi/v1/adlQuantile', params);
  }

  async getForceOrders(request: AsterForceOrdersQuery = {}): Promise<AsterForceOrder[]> {
    const params = this.attachRecvWindow(
      {
        symbol: request.symbol,
        autoCloseType: request.autoCloseType,
        startTime: request.startTime,
        endTime: request.endTime,
        limit: request.limit,
      },
      request.recvWindow
    );
    return this.getSigned<AsterForceOrder[]>('/fapi/v1/forceOrders', params);
  }

  async getCommissionRate(request: AsterCommissionRateQuery): Promise<AsterCommissionRate> {
    const params = this.attachRecvWindow({ symbol: request.symbol }, request.recvWindow);
    return this.getSigned<AsterCommissionRate>('/fapi/v1/commissionRate', params);
  }

  async createListenKey(): Promise<AsterListenKeyResponse> {
    return this.request<AsterListenKeyResponse>('POST', '/fapi/v1/listenKey', {
      useApiKey: true,
    });
  }

  async keepAliveListenKey(listenKey: string): Promise<Record<string, never>> {
    return this.request<Record<string, never>>('PUT', '/fapi/v1/listenKey', {
      params: { listenKey },
      useApiKey: true,
    });
  }

  async deleteListenKey(listenKey: string): Promise<Record<string, never>> {
    return this.request<Record<string, never>>('DELETE', '/fapi/v1/listenKey', {
      params: { listenKey },
      useApiKey: true,
    });
  }

  private buildOrderParams(order: AsterNewOrderRequest, includeRecvWindow = true): Record<string, unknown> {
    const { recvWindow, ...rest } = order;
    const payload: Record<string, unknown> = {
      symbol: rest.symbol,
      side: rest.side,
      type: rest.type,
    };
    this.assignParam(payload, 'positionSide', rest.positionSide);
    this.assignParam(payload, 'reduceOnly', rest.reduceOnly);
    this.assignParam(payload, 'quantity', rest.quantity);
    this.assignParam(payload, 'price', rest.price);
    this.assignParam(payload, 'newClientOrderId', rest.newClientOrderId);
    this.assignParam(payload, 'stopPrice', rest.stopPrice);
    this.assignParam(payload, 'closePosition', rest.closePosition);
    this.assignParam(payload, 'activationPrice', rest.activationPrice);
    this.assignParam(payload, 'callbackRate', rest.callbackRate);
    this.assignParam(payload, 'timeInForce', rest.timeInForce);
    this.assignParam(payload, 'workingType', rest.workingType);
    this.assignParam(payload, 'priceProtect', rest.priceProtect, true);
    this.assignParam(payload, 'newOrderRespType', rest.newOrderRespType);
    if (includeRecvWindow && recvWindow !== undefined) {
      payload.recvWindow = recvWindow;
    }
    return payload;
  }

  private assignParam(target: Record<string, unknown>, key: string, value: unknown, uppercaseBoolean = false) {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === 'boolean') {
      target[key] = uppercaseBoolean ? (value ? 'TRUE' : 'FALSE') : value ? 'true' : 'false';
      return;
    }
    target[key] = value;
  }

  private attachRecvWindow(params: Record<string, unknown>, recvWindow?: number) {
    if (recvWindow !== undefined) {
      params.recvWindow = recvWindow;
    }
    return params;
  }
}
