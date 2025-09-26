import { blogger } from '../common/base/logger.js'
import { ARBITRAGE_CONFIG, LoadedArbitrageConfig } from './config.js'

// 拓展后的全量参数，包含原始配置与派生的 cron 表达式
export interface ArbitrageParams extends LoadedArbitrageConfig {
  arbitrageCron: string
  navCron: string
}

// 将毫秒周期转换为 cron 表达式，方便统一管理定时任务
function intervalMsToCron(intervalMs: number, label: string): string {
  if (intervalMs <= 0) {
    throw new Error(`Interval for ${label} must be positive. Received ${intervalMs}`)
  }

  if (intervalMs % 1000 !== 0) {
    blogger.warn('interval not aligned to seconds, rounding', { label, intervalMs })
  }
  const totalSeconds = Math.max(1, Math.round(intervalMs / 1000))

  if (totalSeconds < 60) {
    return `*/${totalSeconds} * * * * *`
  }

  if (totalSeconds % 60 === 0 && totalSeconds < 3600) {
    const minutes = totalSeconds / 60
    return `0 */${minutes} * * * *`
  }

  if (totalSeconds % 3600 === 0 && totalSeconds < 86400) {
    const hours = totalSeconds / 3600
    return `0 0 */${hours} * * *`
  }

  if (totalSeconds % 86400 === 0) {
    const days = totalSeconds / 86400
    return `0 0 0 */${days} * *`
  }

  blogger.warn('interval not aligned to common cron cadence, defaulting to 1 minute', {
    label,
    intervalMs
  })
  return '0 */1 * * * *'
}

// 汇总最终参数，供服务启动时直接引用
export const ARBITRAGE_PARAMS: ArbitrageParams = {
  ...ARBITRAGE_CONFIG,
  arbitrageCron: intervalMsToCron(ARBITRAGE_CONFIG.settings.checkIntervalMs, 'arbitrage-loop'),
  navCron: intervalMsToCron(ARBITRAGE_CONFIG.settings.navReportIntervalMs, 'nav-report')
}
