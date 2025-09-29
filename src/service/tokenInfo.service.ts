import { pool } from "../common/db/mysql.js"
import { rdsClient } from "../common/db/redis.js"
import { TSMap } from "../libs/tsmap.js"
import { FundingFeeTokenRep } from "../orm/cross.ff.token.js"
import { FundingFeeTokenExchangeRep } from "../orm/cross.ff.tokenexchange.js"

export enum ETokenType {
  SPOT = 1,
  UFUTURE = 2
}

export type TChainToken = {
  id: number
  chainToken: string
  grading: number
}

export type TExchangeToken = {
  id: number
  tokenId: number
  exchangeToken: string
  exchangeName: string
  cexId: number
  tokenType: number
}

export type TTokenInfo = {
  chainToken: TChainToken,
  // 按交易所ID索引的交易所token映射，方便快速定位指定交易所信息
  exchangeTokenMap: Partial<Record<number, TExchangeToken>>
}

export type TExchangeTokenInfo = {
  chainToken: string
  exchangeTokenInfo: TExchangeToken
}

/**
 * TokenInfoService 负责维护链上token与各交易所token之间的映射关系
 * 包括缓存重建、Redis读取等能力，方便套利和资费等模块复用
 */
export class TokenInfoService {

  private static readonly TOKEN_INFO_TTL = 10 * 3600
  private static readonly EXCHANGE_TOKEN_INFO_TTL = TokenInfoService.TOKEN_INFO_TTL + 60

  /**
   * 获取token info的redis key
   * @param tokenType 
   * @returns 
   */
  static getTokenInfoKey(tokenType: ETokenType): string {
    return `APX:CROSS:FF:TOKEN_INFO:${tokenType}`
  }

  static getExchangeTokenInfoKey(tokenType: ETokenType): string {
    return `APX:CROSS:FF:TOKEN_INFO:EXCHANGE:${tokenType}`
  }

  static getExchangeTokenKey(exchangeName: string, chainToken: string): string {
    return `${exchangeName}-${chainToken}`
  }

  /**
   * 获取token info map
   * @param tokenType 
   * @returns 
   */
  static async getTokenInfoMap(tokenType: ETokenType): Promise<TSMap<string, TTokenInfo>> {
    const key = this.getTokenInfoKey(tokenType)
    const cachedValue = await rdsClient.get(key)
    if (cachedValue) {
      return new TSMap<string, TTokenInfo>().fromJSON(JSON.parse(cachedValue))
    }

    const { tokenInfoMap } = await this.rebuildCache(tokenType)
    return tokenInfoMap
  }

  /**
   * 获取永续合约token列表
   * @returns 
   */
  static async getFuturesTokenMap(): Promise<TSMap<string, TTokenInfo>> {
    const tokenInfo = await this.getTokenInfoMap(ETokenType.UFUTURE)
    return tokenInfo
  }

  /**
   * 获取现货token列表
   * @returns 
   */
  static async getSpotTokenMap(): Promise<TSMap<string, TTokenInfo>> {
    const tokenInfo = await this.getTokenInfoMap(ETokenType.SPOT)
    return tokenInfo
  }

  static async getExchangeTokenInfoMap(tokenType: ETokenType): Promise<TSMap<string, TExchangeTokenInfo>> {
    const key = this.getExchangeTokenInfoKey(tokenType)
    const cachedValue = await rdsClient.get(key)
    if (cachedValue) {
      return new TSMap<string, TExchangeTokenInfo>().fromJSON(JSON.parse(cachedValue))
    }

    const { exchangeTokenInfoMap } = await this.rebuildCache(tokenType)
    return exchangeTokenInfoMap
  }

  static async getFuturesExchangeTokenInfoMap(): Promise<TSMap<string, TExchangeTokenInfo>> {
    return await this.getExchangeTokenInfoMap(ETokenType.UFUTURE)
  }

  /**
   * 根据交易所名称和交易所token获取链token
   * @param exchangeName  // 交易所名称
   * @param exchangeToken  // 交易所token
   * @param exchangeTokenInfoMap  // 交易所token信息map
   * @returns 
   */
  static async getChainToken(exchangeName: string, exchangeToken: string, exchangeTokenInfoMap?: TSMap<string, TExchangeTokenInfo>): Promise<string | undefined> {
    const key = this.getExchangeTokenKey(exchangeName, exchangeToken)
    if (!exchangeTokenInfoMap) {
      exchangeTokenInfoMap = await this.getFuturesExchangeTokenInfoMap()
    }
    const tokenInfo = exchangeTokenInfoMap.get(key)
    if (tokenInfo) {
      return tokenInfo.chainToken
    }
  }

  private static async rebuildCache(tokenType: ETokenType): Promise<{
    tokenInfoMap: TSMap<string, TTokenInfo>,
    exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  }> {
    const { tokenInfoMap, exchangeTokenInfoMap } = await this.buildTokenData(tokenType)
    await Promise.all([
      rdsClient.set(this.getTokenInfoKey(tokenType), JSON.stringify(tokenInfoMap), this.TOKEN_INFO_TTL),
      rdsClient.set(this.getExchangeTokenInfoKey(tokenType), JSON.stringify(exchangeTokenInfoMap), this.EXCHANGE_TOKEN_INFO_TTL)
    ])
    return { tokenInfoMap, exchangeTokenInfoMap }
  }

  private static async buildTokenData(tokenType: ETokenType): Promise<{
    tokenInfoMap: TSMap<string, TTokenInfo>,
    exchangeTokenInfoMap: TSMap<string, TExchangeTokenInfo>
  }> {
    const tokenRep = new FundingFeeTokenRep(pool)
    const tokenExchangeRep = new FundingFeeTokenExchangeRep(pool)

    // 获取token列表和token交易所列表
    const [tokenList, tokenExchangeList] = await Promise.all([
      tokenRep.getAll(),
      tokenExchangeRep.getAll()
    ])

    const chainTokenById = new Map<number, TChainToken>()
    const tokenInfoByChainToken = new Map<string, TTokenInfo>()

    // 初始化链token信息
    for (const token of tokenList) {
      if (token.isDeleted) continue
      const chainToken: TChainToken = {
        id: token.id,
        chainToken: token.chainToken,
        grading: token.grading
      }
      chainTokenById.set(token.id, chainToken)
      tokenInfoByChainToken.set(chainToken.chainToken, {
        chainToken,
        exchangeTokenMap: {}
      })
    }

    const exchangeTokenInfoByKey = new Map<string, TExchangeTokenInfo>()

    // 填充交易所token映射和双向索引
    for (const tokenExchange of tokenExchangeList) {
      if (tokenExchange.isDeleted) continue
      if (tokenExchange.tokenType !== tokenType) {
        continue
      }

      const chainToken = chainTokenById.get(tokenExchange.tokenId)
      if (!chainToken) {
        continue
      }

      const exchangeToken: TExchangeToken = {
        id: tokenExchange.id,
        tokenId: tokenExchange.tokenId,
        exchangeToken: tokenExchange.exchangeToken,
        exchangeName: tokenExchange.exchangeName,
        cexId: tokenExchange.cexId,
        tokenType: tokenExchange.tokenType
      }

      const tokenInfo = tokenInfoByChainToken.get(chainToken.chainToken)
      if (tokenInfo) {
        // 以cexId为key快速定位交易所映射
        tokenInfo.exchangeTokenMap[tokenExchange.cexId] = exchangeToken
      }

      const exchangeTokenInfo: TExchangeTokenInfo = {
        chainToken: chainToken.chainToken,
        exchangeTokenInfo: exchangeToken
      }

      const chainTokenKey = this.getExchangeTokenKey(tokenExchange.exchangeName, chainToken.chainToken)
      exchangeTokenInfoByKey.set(chainTokenKey, exchangeTokenInfo)

      // 保存按合约token和交易所token两种key的映射，兼容不同调用场景
      const exchangeTokenKey = this.getExchangeTokenKey(tokenExchange.exchangeName, tokenExchange.exchangeToken)
      exchangeTokenInfoByKey.set(exchangeTokenKey, exchangeTokenInfo)
    }

    const tokenInfoMap = new TSMap<string, TTokenInfo>()
    for (const [chainToken, info] of tokenInfoByChainToken) {
      tokenInfoMap.set(chainToken, info)
    }

    const exchangeTokenInfoMap = new TSMap<string, TExchangeTokenInfo>()
    for (const [key, info] of exchangeTokenInfoByKey) {
      exchangeTokenInfoMap.set(key, info)
    }

    return { tokenInfoMap, exchangeTokenInfoMap }
  }
}
