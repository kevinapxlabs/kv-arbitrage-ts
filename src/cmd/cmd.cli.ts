import BigNumber from "bignumber.js"
import { defiConfig } from "../config/config.js"
import { AESCipher } from "../utils/blockin.cipher.js"
import { CrossCreateData } from "./create.data.js"
import { ExchangeIndexMgr } from "../arbitrage/exchange.index.js"
import { TKVPosition } from "../exchanges/types.js"
import { TSMap } from "../libs/tsmap.js"
import { ArbitrageConfig } from "../arbitrage/arbitrage.config.js"
import { getKeyInfo } from "../utils/bnKey.js"
import { AsterAccountApi } from "../libs/aster/aster.account.api.js"
import { BpxApiClient } from "../libs/bpxClient/bpxApiClient.js"
import { FuturePositionWithMargin } from "../libs/bpxClient/index.js"

export class CmdCliMgr {
  async run() {
    const order = process.argv[2]
    switch (order) {
      case 'encrypt':
        await this.encrypt()
        break
      case 'asterAccountInfo':
        await this.asterAccountInfo()
        break
      case 'asterPositionInfo':
        await this.asterPositionInfo()
        break
      case 'bpAccountInfo':
        await this.bpAccountInfo()
        break
      case 'bpPositionInfo':
        await this.bpPositionInfo()
        break
      case 'positionInfo':
        await this.positionInfo()
        break
      case 'createTestData':
        await this.createTestData()
        break
      default:
        this.help()
        break
    }
  }

  async encrypt() {
    const content = process.argv[3]
    if (!content) {
      this.help()
      return
    }
    const pwd = defiConfig.pwd
    const aes = new AESCipher(`${pwd}1114`)
    const encryptedText = aes.encrypt(content)
    console.log(`text: ${encryptedText}`)
  }

  async asterAccountInfo() {
    const asterCfg = defiConfig.asterCfg
    const keyInfo = getKeyInfo(asterCfg.apiKey, asterCfg.apiSecret, '', defiConfig.pwd)
    const accountApi = new AsterAccountApi({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      const accountInfo = await accountApi.getAccountInfo()
      const positions = accountInfo.positions
      const assets = accountInfo.assets
      accountInfo.positions = []
      accountInfo.assets = []
      console.log(accountInfo)
      for (const position of positions) {
        if (!BigNumber(position.positionAmt).eq(0)) {
          console.log(position)
        }
      }
      for (const asset of assets) {
        if (!BigNumber(asset.crossWalletBalance).eq(0)) {
          console.log(asset)
        }
      }
    } catch (error) {
      console.error('asterAccountInfo failed, error: ', error)
    }
  }

  async asterPositionInfo() {
    const asterCfg = defiConfig.asterCfg
    const keyInfo = getKeyInfo(asterCfg.apiKey, asterCfg.apiSecret, '', defiConfig.pwd)
    const accountApi = new AsterAccountApi({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      const positionInfo = await accountApi.getPositionRisk()
      console.log('position length:', positionInfo.length)
      for (const position of positionInfo) {
        if (!BigNumber(position.positionAmt).eq(0)) {
          console.log(position)
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  async bpAccountInfo() {
    const bpCfg = defiConfig.backpackCfg
    const keyInfo = getKeyInfo(bpCfg.apiKey, bpCfg.apiSecret, '', defiConfig.pwd)
    const accountApi = new BpxApiClient({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      const accountInfo = await accountApi.capital.getCollateral()
      console.log(accountInfo)
    } catch (error) {
      console.error('bpAccountInfo failed, error: ', error)
    }
  }

  async bpPositionInfo() {
    const bpCfg = defiConfig.backpackCfg
    const keyInfo = getKeyInfo(bpCfg.apiKey, bpCfg.apiSecret, '', defiConfig.pwd)
    const accountApi = new BpxApiClient({
      apiKey: keyInfo.apiKey,
      apiSecret: keyInfo.secret
    })
    try {
      const positionInfo = await accountApi.futures.getOpenPositions()
      if (positionInfo.statusCode !== 200) {
        throw new Error(`bpPositionInfo failed, statusCode: ${positionInfo.statusCode}, message: ${JSON.stringify(positionInfo.error)}`)
      }
      console.log('position length:', positionInfo.data.length)
      const data = positionInfo.data as FuturePositionWithMargin[]
      for (const position of data) {
        if (!BigNumber(position.netQuantity).eq(0)) {
          console.log(position)
        }
      }
    } catch (error) {
      console.error('bpPositionInfo failed, error: ', error)
    }
  }

  // 获取positionInfo
  async positionInfo() {
    const traceId = 'cmd cli positionInfo test'
    const arbitrageConfig = await ArbitrageConfig.getConfig()
    const exchangeIndex = new ExchangeIndexMgr(traceId, arbitrageConfig)
    const exchangeList = exchangeIndex.exchangeList
    const positionMap: TSMap<string, (TKVPosition | null)[]> = new TSMap()
    const exchangeNames: string[] = []
    for (let i = 0; i < exchangeList.length; i++) {
      const exchange = exchangeList[i]
      exchangeNames.push(exchange.exchangeName)
      const positions = await exchange.getPositions()
      for (const position of positions) {
        const exchangeToken = position.exchangeToken
        let positionList = positionMap.get(exchangeToken)
        if (!positionList) {
          positionList = Array.from({ length: exchangeList.length }, () => null)
        }
        positionList[i] = position
        positionMap.set(exchangeToken, positionList)
      }
    }
    console.log('exchangeNames:', exchangeNames.join(', '))
    for (const exchangeToken of positionMap.keys()) {
      const positionList = positionMap.get(exchangeToken)
      if (!positionList) continue
      const totalPositonAmt = BigNumber(0)
      const texts: string[] = []
      for (let i = 0; i < positionList.length; i++) {
        const position = positionList[i]
        if (position) {
          texts.push(position.positionAmt)
          totalPositonAmt.plus(position.positionAmt)
        } else {
          texts.push('null')
        }
      }
      if (totalPositonAmt.isZero()) {
        console.log(`${exchangeToken}: ${totalPositonAmt.toFixed(2)}: ${texts.join(', ')}`)
      } else {
        console.log(`====================${exchangeToken}: ${totalPositonAmt.toFixed(2)}: ${texts.join(', ')}`)
      }
    }
  }

  async createTestData() {
    const createData = new CrossCreateData()
    await createData.createData()
  }

  help() {
    const help = `usage:
    node cmd.cli.js encrypt   <content>
          asterAccountInfo    获取aster账户信息
          asterPositionInfo   获取aster持仓信息
          bpAccountInfo       获取bp账户信息
          bpPositionInfo      获取bp持仓信息
          positionInfo        获取positionInfo
          createTestData      创建测试数据
`
      console.log(help)
  }
}


(async () => {
  const cli = new CmdCliMgr()
  await cli.run()
})()

