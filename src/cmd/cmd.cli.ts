import BigNumber from "bignumber.js"
import { defiConfig } from "../config/config.js"
import { AESCipher } from "../utils/blockin.cipher.js"
import { CrossCreateData } from "./create.data.js"
import { ExchangeIndexMgr } from "../arbitrage/exchange.index.js"
import { TKVPosition } from "../exchanges/types.js"
import { TSMap } from "../libs/tsmap.js"
import { ArbitrageConfig } from "../arbitrage/arbitrage.config.js"

export class CmdCliMgr {
  async run() {
    const order = process.argv[2]
    switch (order) {
      case 'encrypt':
        await this.encrypt()
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
    node cmd.cli.js encrypt <content>
          positionInfo    获取positionInfo
          createTestData  创建测试数据
`
      console.log(help)
  }
}


(async () => {
  const cli = new CmdCliMgr()
  await cli.run()
})()

