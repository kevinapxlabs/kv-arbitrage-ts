import { pool } from "../common/db/mysql.js"
import { rdsClient } from "../common/db/redis.js"
import { RedisKeyMgr } from "../common/redis.key.js"
import { defiConfig } from "../config/config.js"
import { TSMap } from "../libs/tsmap.js"
import { ArbitrageConfigRep } from "../orm/arbitrage.config.js"

export interface TArbitrageConfig {
  PAUSE: boolean                      // 是否暂停

  // 交易所保证金比例
  BP_MARGIN_RATIO_1: number
  BP_MARGIN_RATIO_2: number
  BP_MARGIN_RATIO_3: number
  ASTER_MARGIN_RATIO_1: number
  ASTER_MARGIN_RATIO_2: number
  ASTER_MARGIN_RATIO_3: number

  SHARES: number                      // 投资人总投资额

  // increase position
  PRICE_DELTA_BPS: number               // 两交易所币对价差 bps
  MAX_POSITION_COUNTER: number          // 每轮执行最大开仓位数量
  MAX_POSITION_TOKEN_COUNTER: number    // 交易所最大持仓token种类
  MAX_USD_EXCHANGE_AMOUNT_TOKEN: number // 每个币种持仓最大金额
  TOKEN_BANNED_LIST: string[]             // 直接指定减仓的token

  REBALANCE_MAX_USD_AMOUNT: number      // 重新平衡最大金额, 按 USD 计算

  REDUCE_ONLY: boolean                    // 是否只减仓不加仓, 默认是false, 当撤仓时执行

  SETTLEMENT_PRICE_VAR_BPS_MIN: number          // 结算价格差价最小值
  SETTLEMENT_PRICE_VAR_BPS_MAX: number          // 结算价格差价最大值
}

// 由于 TypeScript 的类型信息在运行时不可用，无法直接通过空对象获取类型的键
// 因此需要手动罗列所有可能的键
const requiredKeys: (keyof TArbitrageConfig)[] = [
  'PAUSE',
  'BP_MARGIN_RATIO_1',
  'BP_MARGIN_RATIO_2',
  'BP_MARGIN_RATIO_3',
  'ASTER_MARGIN_RATIO_1',
  'ASTER_MARGIN_RATIO_2',
  'ASTER_MARGIN_RATIO_3',
  'SHARES',
  'PRICE_DELTA_BPS',
  'MAX_POSITION_COUNTER',
  'MAX_POSITION_TOKEN_COUNTER',
  'MAX_USD_EXCHANGE_AMOUNT_TOKEN',
  'REBALANCE_MAX_USD_AMOUNT',
  'REDUCE_ONLY',
  'TOKEN_BANNED_LIST',
  'SETTLEMENT_PRICE_VAR_BPS_MIN',
  'SETTLEMENT_PRICE_VAR_BPS_MAX'
]

const typeConverters: Record<string, (value: string) => any> = {
  PAUSE: (value: string): boolean => {
    return value !== "0"
  },
  REDUCE_ONLY: (value: string): boolean => {
    return value !== "0"
  },
  TOKEN_BANNED_LIST: (value: string) => {
    const res = []
    if (value) {
      const tokens = value.split(",")
      for (const token of tokens) {
        const upperToken = token.trim().toUpperCase()
        if (upperToken) {
          res.push(upperToken)
        }
      }
    }
    return res
  }
}

export class ArbitrageConfig {
  static projectName = defiConfig.projectName

  // 将db中的配置转换为对应的类型
  static convertJsonToType<T>(jsonData: TSMap<string, string>): T {
    const result: TSMap<string, any> = new TSMap<string, any>()
    // 1. 将jsonData中的key转换为大写
    const typeMap: Record<string, string> = {}
    jsonData.keys().forEach((key) => {
      typeMap[key] = key.toUpperCase()
    })
    // 2. 根据typeMap中的key，将jsonData中的value转换为对应的类型
    for (const [key, value] of jsonData.entries()) {
      const upperKey = key.toUpperCase()
      const converter = typeConverters[upperKey]
      try {
        if (converter) {
          result.set(upperKey, converter(value));
        } else {
          result.set(upperKey, Number(value));
        }
      } catch (error) {
        throw new Error(`Failed to convert field ${key}: ${error}`);
      }
    }
    return result.toJSON() as T;
  }

  // 获取配置
  static async getConfig(): Promise<TArbitrageConfig> {
    const projectName = defiConfig.projectName
    const cacheKey = RedisKeyMgr.arbitrageConfigKey(projectName)
    const cacheConfig = await rdsClient.get(cacheKey)
    if (cacheConfig) {
      return JSON.parse(cacheConfig) as TArbitrageConfig
    }
    const configRep = new ArbitrageConfigRep(pool)
    const configs = await configRep.queryByProjectName(projectName)
    // console.log(configs)
    const dbConfigJson = new TSMap<string, string>()
    configs.forEach((config) => {
      dbConfigJson.set(config.proKey, config.proValue)
    })
    const config = ArbitrageConfig.convertJsonToType<TArbitrageConfig>(dbConfigJson)
    // 3. 检查配置是否完整
    for (const key of requiredKeys) {
      if (!(key in config) || config[key] === undefined || config[key] === null) {
        throw new Error(`Property ${key} is missing or not assigned in ${projectName}`);
      }
    }
    await rdsClient.set(cacheKey, JSON.stringify(config), 4 * 60 * 60)
    return config
  }
}
