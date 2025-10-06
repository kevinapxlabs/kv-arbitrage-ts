import BigNumber from "bignumber.js"
import { EExchange } from "../common/exchange.enum.js"
import { TSMap } from "../libs/tsmap.js"
import { TAccountInfo, TKVPosition } from "../exchanges/types.js"
import { TExchangeRiskInfo, TRiskDataInfo, TTokenPosition } from "../arbitrage/type.js"

export class RiskDataMock {
  static accountInfo(): TAccountInfo {
    return  {
      totalNetEquity: '1000',
      totalPositiveNotional: '1000',
      asterAccountInfo: null,
      bpAccountInfo: null,
    }
  }

  static getKvPosition(
    exchangeName: EExchange,
    symbol: string,
    exchangeToken: string,
    positionAmt: string,
    notional: string
  ): TKVPosition {
    return {
      exchangeName,
      symbol,
      exchangeToken,
      leverage: '5',
      positionAmt,
      notional,
    }
  }

  static exchangeTokenPositionMap(): TSMap<string, TTokenPosition> {
    const map = new TSMap<string, TTokenPosition>()
    map.set('LINK', {
      notional: '300',
      positions: [
        this.getKvPosition(EExchange.Aster, 'LINKUSDT', 'LINK', '10', '1000'),
        this.getKvPosition(EExchange.Backpack, 'LINK_USDC_PERP', 'LINK', '-10', '1000'),
      ],
    })
    return map
  }

  static exchangeRiskInfo(): TSMap<EExchange, TExchangeRiskInfo> {
    const map = new TSMap<EExchange, TExchangeRiskInfo>()
    map.set(EExchange.Aster, {
      totalNotional: BigNumber('0'),
      positiveNotional: BigNumber('0'),
      negativeNotional: BigNumber('0'),
      positionCounter: 0
    })
    map.set(EExchange.Backpack, {
      totalNotional: BigNumber('0'),
      positiveNotional: BigNumber('0'),
      negativeNotional: BigNumber('0'),
      positionCounter: 0
    })
    return map
  }
  
  static getRiskData(): TRiskDataInfo {
    return {
      accountInfo: this.accountInfo(),
      chainTokenPositionMap: this.exchangeTokenPositionMap(),
      exchangeRiskInfo: this.exchangeRiskInfo()
    }
  }
}
