import path from "node:path"
import { readFile } from "node:fs/promises"

import { blogger } from "../common/base/logger.js"
import { EExchange, EExchangeCexId } from "../common/exchange.enum.js"
import { rdsClient } from "../common/db/redis.js"
import { TSMap } from "../libs/tsmap.js"
import {
  ETokenType,
  TExchangeTokenInfo,
  TokenInfoService,
  TTokenInfo
} from "./tokenInfo.service.js"
import { ExchangeAdapter } from "../exchanges/exchange.adapter.js"
import { ArbitrageConfig } from "../arbitrage/arbitrage.config.js"
import { ExchangeIndexMgr } from "../arbitrage/exchange.index"

type TTokenInfoFileEntry = {
  id: number
  cexID: number
  symbol: string
  baseToken: string
}

export class TokenInfoFileService {
  private static readonly TOKEN_INFO_PATH = path.resolve(process.cwd(), "config/tokeninfo.json")
  private static readonly TOKEN_INFO_TTL = 10 * 3600
  private static futuresTokenPromise: Promise<{
    tokenInfoMap: TSMap<string, TTokenInfo>
    exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  }> | null = null

  /**
   * 获取永续合约链上token映射（中文注释）
   */
  static async getFuturesTokenMap(): Promise<TSMap<string, TTokenInfo>> {
    const { tokenInfoMap } = await this.loadFuturesTokenData()
    return tokenInfoMap
  }

  /**
   * 获取永续合约交易所token映射列表
   */
  static async getFuturesExchangeTokenInfoMap(): Promise<TSMap<string, TExchangeTokenInfo>> {
    const { exchangeTokenInfoMap } = await this.loadFuturesTokenData()
    return exchangeTokenInfoMap
  }

  /**
   * 加载或构建永续合约token数据，内部带缓存
   */
  private static async loadFuturesTokenData(): Promise<{
    tokenInfoMap: TSMap<string, TTokenInfo>
    exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  }> {
    if (!this.futuresTokenPromise) {
      this.futuresTokenPromise = this.fetchFuturesTokenData().catch((error) => {
        this.futuresTokenPromise = null
        throw error
      })
    }
    return this.futuresTokenPromise
  }

  /**
   * 先尝试读取redis缓存，失败则回源并写入
   */
  private static async fetchFuturesTokenData(): Promise<{
    tokenInfoMap: TSMap<string, TTokenInfo>
    exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  }> {
    const cached = await this.loadFromRedis()
    if (cached) {
      return cached
    }

    const tokenData = await this.buildFuturesTokenData()
    await this.saveToRedis(tokenData)
    return tokenData
  }

  /**
   * 基于配置文件构建永续合约token数据
   */
  private static async buildFuturesTokenData(): Promise<{
    tokenInfoMap: TSMap<string, TTokenInfo>
    exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  }> {
    const entries = await this.loadTokenInfoEntries()
    const tokenInfoMap = new TSMap<string, TTokenInfo>()
    const exchangeTokenInfoMap = new TSMap<string, TExchangeTokenInfo>()

    const exchangeMap = await this.getExchangeMap()

    for (const entry of entries) {
      const chainToken = this.normalize(entry.baseToken)
      const normalizedSymbol = this.normalize(entry.symbol)
      const exchange = exchangeMap.get(entry.cexID)
      if (!exchange) {
        throw new Error(`Exchange not found: ${entry.cexID}`)
      }
      const exchangeName = exchange.exchangeName
      const exchangeToken = {
        id: entry.id,
        tokenId: 0,
        exchangeToken: exchange.getExchangeToken(entry.symbol),
        exchangeName,
        cexId: entry.cexID,
        tokenType: 2
      }

      let tokenInfo = tokenInfoMap.get(chainToken)
      if (!tokenInfo) {
        tokenInfo = {
          chainToken: {
            id: entry.id,
            chainToken,
            grading: 1
          },
          exchangeTokenMap: {}
        }
      }

      tokenInfo.exchangeTokenMap[entry.cexID] = exchangeToken
      tokenInfoMap.set(chainToken, tokenInfo)

      const exchangeTokenInfo = {
        chainToken,
        exchangeTokenInfo: exchangeToken
      }

      // allow lookups by chain token (standard) and normalized exchange symbol
      exchangeTokenInfoMap.set(TokenInfoService.getExchangeTokenKey(exchangeName, chainToken), exchangeTokenInfo)

      if (normalizedSymbol.length > 0) {
        exchangeTokenInfoMap.set(TokenInfoService.getExchangeTokenKey(exchangeName, normalizedSymbol), exchangeTokenInfo)
      }
    }

    return { tokenInfoMap, exchangeTokenInfoMap }
  }

  /**
   * 从redis加载token映射缓存
   */
  private static async loadFromRedis(): Promise<{
    tokenInfoMap: TSMap<string, TTokenInfo>
    exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  } | undefined> {
    try {
      const [tokenInfoRaw, exchangeTokenInfoRaw] = await Promise.all([
        rdsClient.get(this.getTokenInfoCacheKey()),
        rdsClient.get(this.getExchangeTokenInfoCacheKey())
      ])
      if (!tokenInfoRaw || !exchangeTokenInfoRaw) {
        return undefined
      }
      const tokenInfoMap = new TSMap<string, TTokenInfo>().fromJSON(JSON.parse(tokenInfoRaw))
      const exchangeTokenInfoMap = new TSMap<string, TExchangeTokenInfo>().fromJSON(JSON.parse(exchangeTokenInfoRaw))
      return { tokenInfoMap, exchangeTokenInfoMap }
    } catch (error) {
      blogger.warn("TokenInfoFileService load redis cache failed", { error })
      return undefined
    }
  }

  /**
   * 将最新token映射写入redis
   */
  private static async saveToRedis(data: {
    tokenInfoMap: TSMap<string, TTokenInfo>
    exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  }): Promise<void> {
    try {
      // keep TTLs in sync with DB-backed TokenInfoService to avoid cache skew
      await Promise.all([
        rdsClient.set(this.getTokenInfoCacheKey(), JSON.stringify(data.tokenInfoMap), this.TOKEN_INFO_TTL),
        rdsClient.set(this.getExchangeTokenInfoCacheKey(), JSON.stringify(data.exchangeTokenInfoMap), this.TOKEN_INFO_TTL)
      ])
    } catch (error) {
      blogger.warn("TokenInfoFileService save redis cache failed", { error })
    }
  }

  /**
   * 读取并校验配置文件中的token条目
   */
  private static async loadTokenInfoEntries(): Promise<TTokenInfoFileEntry[]> {
    const fileContent = await readFile(this.TOKEN_INFO_PATH, "utf8")
    const parsed = JSON.parse(fileContent)
    if (!Array.isArray(parsed)) {
      throw new Error("tokeninfo.json is not an array")
    }

    return parsed
      .filter((item): item is TTokenInfoFileEntry => this.isValidEntry(item))
      .map((item) => ({
        id: Number(item.id),
        cexID: Number(item.cexID),
        symbol: String(item.symbol),
        baseToken: String(item.baseToken)
      }))
  }

  /**
   * 校验配置条目结构是否符合要求
   */
  private static isValidEntry(entry: unknown): entry is TTokenInfoFileEntry {
    if (!entry || typeof entry !== "object") {
      return false
    }
    const value = entry as Record<string, unknown>
    return (
      typeof value.id === "number" &&
      typeof value.cexID === "number" &&
      typeof value.symbol === "string" &&
      typeof value.baseToken === "string"
    )
  }

  /**
   * 根据cexId映射到交易所名称
   */
  private static async getExchangeMap(): Promise<Map<number, ExchangeAdapter>> {
    const traceId = `tokeninfo`
    const arbitrageConfig = await ArbitrageConfig.getConfig()
    const exchanges = new Map<number, ExchangeAdapter>()
    const exchangeMgr = new ExchangeIndexMgr(traceId, arbitrageConfig)
    for (const exchange of exchangeMgr.exchangeList) {
      exchanges.set(exchange.cexId, exchange)
    }
    return exchanges
  }

  /**
   * 统一字符串，去除空格并转大写
   */
  private static normalize(value: string): string {
    return value.trim().toUpperCase()
  }

  /**
   * 永续合约链token缓存key
   */
  private static getTokenInfoCacheKey(): string {
    return TokenInfoService.getTokenInfoKey(ETokenType.UFUTURE)
  }

  /**
   * 永续合约交易所token缓存key
   */
  private static getExchangeTokenInfoCacheKey(): string {
    return TokenInfoService.getExchangeTokenInfoKey(ETokenType.UFUTURE)
  }
}
