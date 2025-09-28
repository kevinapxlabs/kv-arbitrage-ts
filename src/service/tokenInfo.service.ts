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
  exchangeTokenList: TExchangeToken[]
}

export type TExchangeTokenInfo = {
  chainToken: string
  exchangeTokenInfo: TExchangeToken
}

export class TokenInfoService {

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
    // 1. 从redis中获取
    const key = this.getTokenInfoKey(tokenType)
    const tokenListStr = await rdsClient.get(key)
    if (tokenListStr) {
      return new TSMap<string, TTokenInfo>().fromJSON(JSON.parse(tokenListStr))
    }
    // 2. 从数据库中获取 token info list
    const tokenMapTmp = new TSMap<number, TTokenInfo>()
    // 2.1 获取token列表
    const tokenRep = new FundingFeeTokenRep(pool)
    const tokenList = await tokenRep.getAll()
    for (const token of tokenList) {
      // 过滤掉已删除的token
      if (token.isDeleted) continue
      tokenMapTmp.set(token.id, {
        chainToken: {
          id: token.id,
          chainToken: token.chainToken,
          grading: token.grading
        },
        exchangeTokenList: []
      })
    }
    // 2.2 获取token exchange列表
    const tokenExchangeRep = new FundingFeeTokenExchangeRep(pool)
    const tokenExchangeList = await tokenExchangeRep.getAll()
    for (const tokenExchange of tokenExchangeList) {
      // 过滤掉非指定类型的token
      if (tokenExchange.tokenType !== tokenType) continue
      // 过滤掉已删除的token exchange
      if (tokenExchange.isDeleted) continue
      const tokenInfo = tokenMapTmp.get(tokenExchange.tokenId)
      if (tokenInfo) {
        tokenInfo.exchangeTokenList.push({
          id: tokenExchange.id,
          tokenId: tokenExchange.tokenId,
          exchangeToken: tokenExchange.exchangeToken,
          exchangeName: tokenExchange.exchangeName,
          cexId: tokenExchange.cexId,
          tokenType: tokenExchange.tokenType
        })
      }
    }
    // 2.3 转换为map并缓存到redis
    const tokenMap = new TSMap<string, TTokenInfo>()
    for (const tokenInfo of tokenMapTmp.values()) {
      tokenMap.set(tokenInfo.chainToken.chainToken, tokenInfo)
    }
    // 3. 缓存到redis
    await rdsClient.set(key, JSON.stringify(tokenMap), 10 * 3600)
    return tokenMap
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
    // 1. 从redis中获取
    const key = this.getExchangeTokenInfoKey(tokenType)
    const exchangeTokenInfoStr = await rdsClient.get(key)
    if (exchangeTokenInfoStr) {
      return new TSMap<string, TExchangeTokenInfo>().fromJSON(JSON.parse(exchangeTokenInfoStr))
    }
    // 2. 从数据库中获取 token info list
    const tokenMapTmp = new TSMap<number, string>()
    // 2.1 获取token列表
    const tokenRep = new FundingFeeTokenRep(pool)
    const tokenList = await tokenRep.getAll()
    for (const token of tokenList) {
      // 过滤掉已删除的token
      if (token.isDeleted) continue
      tokenMapTmp.set(token.id, token.chainToken)
    }
    // 2.2 获取token exchange列表
    const tokenMap = new TSMap<string, TExchangeTokenInfo>()
    const tokenExchangeRep = new FundingFeeTokenExchangeRep(pool)
    const tokenExchangeList = await tokenExchangeRep.getAll()
    for (const tokenExchange of tokenExchangeList) {
      // 过滤掉非指定类型的token
      if (tokenExchange.tokenType !== tokenType) continue
      // 过滤掉已删除的token exchange
      if (tokenExchange.isDeleted) continue
      const chainToken = tokenMapTmp.get(tokenExchange.tokenId)
      if (chainToken) {
        const t: TExchangeTokenInfo = {
          chainToken: chainToken,
          exchangeTokenInfo: {
            id: tokenExchange.id,
            tokenId: tokenExchange.tokenId,
            exchangeToken: tokenExchange.exchangeToken,
            exchangeName: tokenExchange.exchangeName,
            cexId: tokenExchange.cexId,
            tokenType: tokenExchange.tokenType
          }
        }
        // key 和 key2 的区别是，key是合约token，key2是交易所token, 可能会相同
        // 缓存到map, 以 [交易所名称-合约token] 作为key
        const k = this.getExchangeTokenKey(tokenExchange.exchangeName, chainToken)
        tokenMap.set(k, t)
        // 缓存到map, 以 [交易所名称-合约token] 作为key
        const k2 = this.getExchangeTokenKey(tokenExchange.exchangeName, tokenExchange.exchangeToken)
        tokenMap.set(k2, t)
      }
    }
    // 3. 缓存到redis
    await rdsClient.set(key, JSON.stringify(tokenMap), 10 * 3600 + 60)
    return tokenMap
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
}
