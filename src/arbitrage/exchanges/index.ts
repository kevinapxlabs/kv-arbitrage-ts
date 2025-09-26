import { ExchangeRuntimeConfig } from '../../config/config.js'
import { blogger } from '../../common/base/logger.js'
import { ExchangeAdapter } from './exchange-adapter.js'
import { AsterExchangeAdapter } from './aster.exchange.js'
import { BackpackExchangeAdapter } from './backpack.exchange.js'

// 根据配置创建对应交易所的适配器
export function createExchangeAdapter(config: ExchangeRuntimeConfig): ExchangeAdapter | null {
  switch (config.type) {
    case 'aster':
      return new AsterExchangeAdapter(config)
    case 'backpack':
      return new BackpackExchangeAdapter(config)
    default:
      blogger.warn('unsupported exchange type', config.type)
      return null
  }
}

// 生成所有交易所适配器的映射，便于按 id 查找
export function createExchangeAdapters(configs: ExchangeRuntimeConfig[]): Map<string, ExchangeAdapter> {
  const adapters = new Map<string, ExchangeAdapter>()
  configs.forEach((cfg) => {
    const adapter = createExchangeAdapter(cfg)
    if (adapter) {
      adapters.set(cfg.id, adapter)
    }
  })
  return adapters
}
