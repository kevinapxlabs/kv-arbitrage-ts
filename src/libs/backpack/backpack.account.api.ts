import {
  BackpackAccountConvertDustPayload,
  BackpackAccountSummary,
  BackpackAccountWithdrawalPayload,
  BackpackBorrowLendExecutePayload,
  BackpackBorrowLendHistory,
  BackpackBorrowLendMarket,
  BackpackBorrowLendPositionWithMargin,
  BackpackCollateral,
  BackpackCreateWithdrawalDelayRequest,
  BackpackDeposit,
  BackpackDepositAddress,
  BackpackMarginAccountSummary,
  BackpackMaxBorrowQuantity,
  BackpackMaxOrderQuantity,
  BackpackMaxWithdrawalQuantity,
  BackpackPositionEstimatedLiquidationPrice,
  BackpackUpdateAccountSettingsRequest,
  BackpackUpdateWithdrawalDelayRequest,
  BackpackWithdrawal,
  BackpackWithdrawalDelay,
} from './backpack.types';
import {
  BackpackBorrowLendLiquidationPriceQuery,
  BackpackBorrowLendMarketHistoryQuery,
  BackpackBorrowLimitQuery,
  BackpackCollateralQuery,
  BackpackDepositAddressQuery,
  BackpackDepositHistoryQuery,
  BackpackOrderLimitQuery,
  BackpackWithdrawalHistoryQuery,
  BackpackWithdrawalLimitQuery,
} from './backpack.interfaces';
import { BackpackApiBase } from './backpack.client';

export class BackpackAccountApi extends BackpackApiBase {
  async getAccountSummary(): Promise<BackpackAccountSummary> {
    return this.getSigned<BackpackAccountSummary>('/api/v1/account');
  }

  async updateAccountSettings(payload: BackpackUpdateAccountSettingsRequest): Promise<void> {
    await this.patchSigned<void>('/api/v1/account', payload);
  }

  async convertDust(payload: BackpackAccountConvertDustPayload): Promise<void> {
    await this.postSigned<void>('/api/v1/account/convertDust', payload);
  }

  async getMaxBorrowQuantity(params: BackpackBorrowLimitQuery): Promise<BackpackMaxBorrowQuantity> {
    return this.getSigned<BackpackMaxBorrowQuantity>('/api/v1/account/limits/borrow', params);
  }

  async getMaxOrderQuantity(params: BackpackOrderLimitQuery): Promise<BackpackMaxOrderQuantity> {
    return this.getSigned<BackpackMaxOrderQuantity>('/api/v1/account/limits/order', params);
  }

  async getMaxWithdrawalQuantity(params: BackpackWithdrawalLimitQuery): Promise<BackpackMaxWithdrawalQuantity> {
    return this.getSigned<BackpackMaxWithdrawalQuantity>('/api/v1/account/limits/withdrawal', params);
  }

  async getBorrowLendPositions(): Promise<BackpackBorrowLendPositionWithMargin[]> {
    return this.getSigned<BackpackBorrowLendPositionWithMargin[]>('/api/v1/borrowLend/positions');
  }

  async submitBorrowLendOrder(payload: BackpackBorrowLendExecutePayload): Promise<void> {
    await this.postSigned<void>('/api/v1/borrowLend', payload);
  }

  async getBorrowLendMarkets(): Promise<BackpackBorrowLendMarket[]> {
    return this.getPublic<BackpackBorrowLendMarket[]>('/api/v1/borrowLend/markets');
  }

  async getBorrowLendMarketHistory(
    params?: BackpackBorrowLendMarketHistoryQuery
  ): Promise<BackpackBorrowLendHistory[]> {
    return this.getPublic<BackpackBorrowLendHistory[]>('/api/v1/borrowLend/markets/history', params);
  }

  async getBorrowLendLiquidationPrice(
    params: BackpackBorrowLendLiquidationPriceQuery
  ): Promise<BackpackPositionEstimatedLiquidationPrice> {
    return this.getPublic<BackpackPositionEstimatedLiquidationPrice>(
      '/api/v1/borrowLend/position/liquidationPrice',
      params
    );
  }

  async getMarginSummary(): Promise<BackpackMarginAccountSummary> {
    return this.getSigned<BackpackMarginAccountSummary>('/api/v1/capital');
  }

  async getCollateralSummary(params?: BackpackCollateralQuery): Promise<BackpackCollateral[]> {
    return this.getSigned<BackpackCollateral[]>('/api/v1/capital/collateral', params);
  }

  async getDepositHistory(params?: BackpackDepositHistoryQuery): Promise<BackpackDeposit[]> {
    return this.getSigned<BackpackDeposit[]>('/wapi/v1/capital/deposits', params);
  }

  async getDepositAddress(params: BackpackDepositAddressQuery): Promise<BackpackDepositAddress> {
    return this.getSigned<BackpackDepositAddress>('/wapi/v1/capital/deposit/address', params);
  }

  async getWithdrawals(params?: BackpackWithdrawalHistoryQuery): Promise<BackpackWithdrawal[]> {
    return this.getSigned<BackpackWithdrawal[]>('/wapi/v1/capital/withdrawals', params);
  }

  async requestWithdrawal(payload: BackpackAccountWithdrawalPayload): Promise<BackpackWithdrawal> {
    return this.postSigned<BackpackWithdrawal>('/wapi/v1/capital/withdrawals', payload);
  }

  async getWithdrawalDelay(options?: { instruction?: string; signed?: boolean }): Promise<BackpackWithdrawalDelay> {
    if (options?.signed === false) {
      return this.request<BackpackWithdrawalDelay>('GET', '/wapi/v1/capital/withdrawals/delay');
    }
    return this.getSigned<BackpackWithdrawalDelay>('/wapi/v1/capital/withdrawals/delay', undefined, options?.instruction);
  }

  async createWithdrawalDelay(
    payload: BackpackCreateWithdrawalDelayRequest,
    options?: { instruction?: string; signed?: boolean }
  ): Promise<void> {
    const signed = options?.signed !== false;
    if (!signed) {
      await this.request('POST', '/wapi/v1/capital/withdrawals/delay', { data: payload });
      return;
    }
    await this.request('POST', '/wapi/v1/capital/withdrawals/delay', {
      data: payload,
      signed: true,
      instruction: options?.instruction,
    });
  }

  async updateWithdrawalDelay(
    payload: BackpackUpdateWithdrawalDelayRequest,
    options?: { instruction?: string; signed?: boolean }
  ): Promise<BackpackWithdrawalDelay> {
    const signed = options?.signed !== false;
    if (!signed) {
      return this.request<BackpackWithdrawalDelay>('PATCH', '/wapi/v1/capital/withdrawals/delay', { data: payload });
    }
    return this.request<BackpackWithdrawalDelay>('PATCH', '/wapi/v1/capital/withdrawals/delay', {
      data: payload,
      signed: true,
      instruction: options?.instruction,
    });
  }
}
