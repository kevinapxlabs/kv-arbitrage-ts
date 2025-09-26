import cron from 'node-cron'
import { blogger } from './common/base/logger.js'
import { ARBITRAGE_PARAMS } from './arbitrage/param.js'
import { TokenRegistry } from './arbitrage/token-registry.js'
import { OrderBookService } from './arbitrage/orderbook.service.js'
import { createExchangeAdapters } from './arbitrage/exchanges/index.js'
import { PositionManager } from './arbitrage/positions/position-manager.js'
import { RiskManager } from './arbitrage/risk/risk-manager.js'
import { NavReporter } from './arbitrage/reporting/reporter.js'
import { ArbitrageEngine } from './arbitrage/strategy/arbitrage-engine.js'

// 启动入口：初始化服务并注册定时任务
async function bootstrap() {
  const { settings, exchanges, tokens, arbitrageCron, navCron } = ARBITRAGE_PARAMS
  const tokenRegistry = new TokenRegistry(tokens)
  const orderBookService = new OrderBookService(settings, exchanges)
  const adapters = createExchangeAdapters(exchanges)
  if (adapters.size < 2) {
    blogger.warn('less than two exchanges available, abort start')
    return
  }
  const positionManager = new PositionManager(settings)
  const riskManager = new RiskManager(settings)
  const reporter = new NavReporter()
  const engine = new ArbitrageEngine(settings, tokenRegistry, orderBookService, adapters, positionManager, riskManager, reporter)
  await engine.initialize()
  await engine.runArbitrageCycle()
  await engine.publishNav()

  cron.schedule(arbitrageCron, () => {
    engine.runArbitrageCycle().catch((error) => {
      blogger.error('cron arbitrage cycle failed', error)
    })
  })

  cron.schedule(navCron, () => {
    engine.publishNav().catch((error) => {
      blogger.error('cron nav report failed', error)
    })
  })

  blogger.info('cron jobs scheduled', { arbitrageCron, navCron })
}

process.on('unhandledRejection', (error) => {
  blogger.error('unhandled rejection', error)
})

process.on('uncaughtException', (error) => {
  blogger.error('uncaught exception', error)
})

bootstrap().catch((error) => {
  blogger.error('failed to start arbitrage engine', error)
})
