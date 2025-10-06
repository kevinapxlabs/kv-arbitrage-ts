import BigNumber from 'bignumber.js'
import { TSMap } from "../libs/tsmap.js"
import { ExchangeIndexMgr } from './exchange.index.js'
import { blogger } from '../common/base/logger.js'
import { TTokenInfo } from '../service/tokenInfo.service.js'
import { TCoinData } from '../common/types/exchange.type.js'
import { ExchangeAdapter } from '../exchanges/exchange.adapter.js'
import { TKVFundingFee } from '../exchanges/types.js'

export class FundingFeeMgr {
  traceId: string
  exchangeIndexMgr: ExchangeIndexMgr
  totalHours = 365 * 24
  historyHours = 48   // 获取48小时内最新历史资费数据
  tokenInfoMap: TSMap<string, TTokenInfo>
  // Cache symbol funding intervals to avoid repeated adapter lookups
  private fundingIntervalHoursCache = new Map<string, number>()

  constructor(traceId: string, exchangeIndexMgr: ExchangeIndexMgr, tokenInfoMap: TSMap<string, TTokenInfo>) {
    this.traceId = traceId
    this.exchangeIndexMgr = exchangeIndexMgr
    this.tokenInfoMap = tokenInfoMap
  }

  /* 获取 exchange 指定数量的历史funding fee 平均值
    @param exchange: 交易所
    @param symbol: 交易所符号 如 BTCUSDT
    @param historyFundingFee: 历史资费数据
    @returns 计算出年化收益率
  */
    async getHistoryFundingFeeAverage(exchange: ExchangeAdapter, symbol: string, historyFundingFee: BigNumber[]): Promise<BigNumber> {
      if (historyFundingFee.length === 0) {
        blogger.info(`${this.traceId} history funding fee list is empty`)
        return BigNumber(0)
      }
      const historyAvgFundingFee = historyFundingFee
        .reduce((a, b) => a.plus(b), BigNumber(0))
        .dividedBy(historyFundingFee.length)
      const cacheKey = `${exchange.cexId}:${symbol}`
      let fundingIntervalHours = this.fundingIntervalHoursCache.get(cacheKey)
      if (fundingIntervalHours === undefined) {
        const fetchedInterval = await exchange.getSymbolInterval(symbol)
        if (fetchedInterval === undefined || fetchedInterval === null) {
          blogger.info(`${this.traceId} funding interval symbol: ${symbol} not found, exchange: ${exchange.exchangeName}`)
          return BigNumber(0)
        }
        fundingIntervalHours = fetchedInterval
        this.fundingIntervalHoursCache.set(cacheKey, fundingIntervalHours)
      }
      const historyAprFundingFee = historyAvgFundingFee
        .multipliedBy(this.totalHours)
        .dividedBy(fundingIntervalHours)
      return historyAprFundingFee
    }

  /**
   * 获取当前资费数据，不包含历史资费数据
   * @returns 
   */
  async getCurrentFundingFeeData() {
    // 2. 获取各交易所的funding Interval
    const exchangeList = this.exchangeIndexMgr.exchangeList
    // 3. 获取当前资费数据
    const currentFundingFeeList: TCoinData[] = []
    // TSMap<baseToken, Array<交易所平均历史资费>>
    const currentFundingFeeMap = new TSMap<string, Array<TKVFundingFee | null>>()
    for (const chainToken of this.tokenInfoMap.keys()) {
      const exchangeInfo = this.tokenInfoMap.get(chainToken)
      if (!exchangeInfo) {
        blogger.error(`${this.traceId} chainToken: ${chainToken} getCurrentFundingFeeData not found in tokenInfoMap`)
        continue
      }
      const exchangeTokenInfoMap = exchangeInfo.exchangeTokenMap
      // Resolve per-exchange funding fees in parallel for the current snapshot
      const historyFundingFees = await Promise.all(
        exchangeList.map(async (exchange) => {
          const exchangeTokenInfo = exchangeTokenInfoMap[exchange.cexId]
          if (!exchangeTokenInfo) {
            blogger.warn(`${this.traceId} exchangeTokenInfo not found, cexId: ${exchange.cexId}, chainToken: ${chainToken}, exchangeName: ${exchange.exchangeName}`)
            return null
          }
          const symbol = exchange.generateOrderbookSymbol(exchangeTokenInfo.exchangeToken)
          try {
            const currentFundingFee = await exchange.getCurrentFundingFee(symbol)
            const fundingFeeAverage = await this.getHistoryFundingFeeAverage(exchange, symbol, [currentFundingFee.fundingFee])
            return { fundingFee: fundingFeeAverage, nextFundingTime: currentFundingFee.nextFundingTime }
          } catch (error) {
            blogger.error(`${this.traceId} failed to get current funding fee, cexId: ${exchange.cexId}, chainToken: ${chainToken}, symbol: ${symbol}, error: ${error instanceof Error ? error.message : error}`)
            return null
          }
        })
      )
      currentFundingFeeMap.set(chainToken, historyFundingFees)
    }
    // 4. 计算当前资费数据列表
    // 多交易所时进行两两比较
    const tokenKeys = currentFundingFeeMap.keys()
    const exchangeIndexList = this.exchangeIndexMgr.exchangeIndexList
    for (const tokenKey of tokenKeys) {
      const hff = currentFundingFeeMap.get(tokenKey)
      if (!hff) {
        continue
      }
      const exchangeInfo = this.tokenInfoMap.get(tokenKey)
      if (!exchangeInfo) {
        blogger.error(`${this.traceId} chainToken: ${tokenKey} getCurrentFundingFeeData not found in tokenInfoMap`)
        continue
      }
      const exchangeTokenInfoMap = exchangeInfo.exchangeTokenMap
      for (const indexArray of exchangeIndexList) {
        const baseExchangeIndex = indexArray[0]
        const quoteExchangeIndex = indexArray[1]
        const baseExchange = exchangeList[baseExchangeIndex]
        const baseExchangeTokenInfo = exchangeTokenInfoMap[baseExchange.cexId]
        if (!baseExchangeTokenInfo) {
          blogger.warn(`${this.traceId} baseExchangeTokenInfo not found, cexId: ${baseExchange.cexId}, chainToken: ${tokenKey}, exchangeName: ${baseExchange.exchangeName}`)
          continue
        }
        const quoteExchange = exchangeList[quoteExchangeIndex]
        const quoteExchangeTokenInfo = exchangeTokenInfoMap[quoteExchange.cexId]
        if (!quoteExchangeTokenInfo) {
          blogger.warn(`${this.traceId} quoteExchangeTokenInfo not found, cexId: ${quoteExchange.cexId}, chainToken: ${tokenKey}, exchangeName: ${quoteExchange.exchangeName}`)
          continue
        }
        const baseRate = hff[baseExchangeIndex]
        const quoteRate = hff[quoteExchangeIndex]
        if (baseRate === null || quoteRate === null) {
          blogger.warn(`${this.traceId} hff[baseExchangeIndex] or hff[quoteExchangeIndex] is null, baseExchangeIndex: ${baseExchangeIndex}, quoteExchangeIndex: ${quoteExchangeIndex}, chainToken: ${tokenKey}`)
          continue
        }
        const total = baseRate.fundingFee.minus(quoteRate.fundingFee).multipliedBy(100)
        // 取两个交易所中最早的下一轮资费时间
        const nextFundingTime = baseRate.nextFundingTime > quoteRate.nextFundingTime ? quoteRate.nextFundingTime : baseRate.nextFundingTime
        currentFundingFeeList.push({
          chainToken: tokenKey,
          baseExchange: baseExchange.exchangeName,
          baseExchangeIndex: baseExchangeIndex,
          baseExchangeRate: baseRate.fundingFee,
          baseExchangeToken: baseExchangeTokenInfo.exchangeToken,
          quoteExchange: quoteExchange.exchangeName,
          quoteExchangeIndex: quoteExchangeIndex,
          quoteExchangeRate: quoteRate.fundingFee,
          quoteExchangeToken: quoteExchangeTokenInfo.exchangeToken,
          nextFundingTime: nextFundingTime,
          total: total
        })
      }
    }
    const orderCurrentFundingFeeList = currentFundingFeeList.sort((a, b) => b.total.abs().minus(a.total.abs()).toNumber())
    return orderCurrentFundingFeeList
  }
}
