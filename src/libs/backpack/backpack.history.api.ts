import {
  BackpackBorrowLendMovement,
  BackpackBorrowLendPositionRow,
  BackpackDustConversion,
  BackpackFundingPayment,
  BackpackInterestPayment,
  BackpackOrder,
  BackpackOrderFill,
  BackpackQuoteHistorical,
  BackpackRequestForQuoteHistorical,
  BackpackSettlement,
  BackpackStrategy,
} from './backpack.types';
import {
  BackpackBorrowLendPositionsHistoryQuery,
  BackpackBorrowLendHistoryQuery,
  BackpackDustHistoryQuery,
  BackpackFillHistoryQuery,
  BackpackFundingHistoryQuery,
  BackpackInterestHistoryQuery,
  BackpackOrderHistoryQuery,
  BackpackQuoteHistoryQuery,
  BackpackRfqHistoryQuery,
  BackpackSettlementHistoryQuery,
  BackpackStrategyHistoryQuery,
} from './backpack.interfaces';
import { BackpackApiBase } from './backpack.client';

export class BackpackHistoryApi extends BackpackApiBase {
  async getBorrowLendHistory(params?: BackpackBorrowLendHistoryQuery): Promise<BackpackBorrowLendMovement[]> {
    return this.getSigned<BackpackBorrowLendMovement[]>('/wapi/v1/history/borrowLend', params);
  }

  async getInterestHistory(params?: BackpackInterestHistoryQuery): Promise<BackpackInterestPayment[]> {
    return this.getSigned<BackpackInterestPayment[]>('/wapi/v1/history/interest', params);
  }

  async getBorrowLendPositionsHistory(
    params?: BackpackBorrowLendPositionsHistoryQuery
  ): Promise<BackpackBorrowLendPositionRow[]> {
    return this.getSigned<BackpackBorrowLendPositionRow[]>('/wapi/v1/history/borrowLend/positions', params);
  }

  async getDustHistory(params?: BackpackDustHistoryQuery): Promise<BackpackDustConversion[]> {
    return this.getSigned<BackpackDustConversion[]>('/wapi/v1/history/dust', params);
  }

  async getFillHistory(params?: BackpackFillHistoryQuery): Promise<BackpackOrderFill[]> {
    return this.getSigned<BackpackOrderFill[]>('/wapi/v1/history/fills', params);
  }

  async getFundingHistory(params?: BackpackFundingHistoryQuery): Promise<BackpackFundingPayment[]> {
    return this.getSigned<BackpackFundingPayment[]>('/wapi/v1/history/funding', params);
  }

  async getOrderHistory(params?: BackpackOrderHistoryQuery): Promise<BackpackOrder[]> {
    return this.getSigned<BackpackOrder[]>('/wapi/v1/history/orders', params);
  }

  async getRfqHistory(params?: BackpackRfqHistoryQuery): Promise<BackpackRequestForQuoteHistorical[]> {
    return this.getSigned<BackpackRequestForQuoteHistorical[]>('/wapi/v1/history/rfq', params);
  }

  async getQuoteHistory(params?: BackpackQuoteHistoryQuery): Promise<BackpackQuoteHistorical[]> {
    return this.getSigned<BackpackQuoteHistorical[]>('/wapi/v1/history/quote', params);
  }

  async getSettlementHistory(params?: BackpackSettlementHistoryQuery): Promise<BackpackSettlement[]> {
    return this.getSigned<BackpackSettlement[]>('/wapi/v1/history/settlement', params);
  }

  async getStrategyHistory(params?: BackpackStrategyHistoryQuery): Promise<BackpackStrategy[]> {
    return this.getSigned<BackpackStrategy[]>('/wapi/v1/history/strategies', params);
  }
}
