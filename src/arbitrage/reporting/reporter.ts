import { blogger } from '../../common/base/logger.js'
import { NavSnapshot, PositionExposureSummary } from '../types.js'

// NAV 报告输出器，统一日志格式
export class NavReporter {
  // 打印当前 NAV 统计信息
  report(snapshot: NavSnapshot): void {
    const summaryLines = snapshot.positions.map((pos) => {
      return `${pos.symbol}: unrealized=${pos.unrealizedPnlUsd.toFixed(2)} realized=${pos.realizedPnlUsd.toFixed(2)} notional=${pos.notionalUsd.toFixed(2)}`
    })
    blogger.info('NAV snapshot', {
      timestamp: new Date(snapshot.timestamp).toISOString(),
      totalRealized: snapshot.totalRealizedPnlUsd,
      totalUnrealized: snapshot.totalUnrealizedPnlUsd,
      totalNotional: snapshot.totalNotionalUsd,
      detail: summaryLines
    })
  }
}

// 汇总仓位数据并生成 NAV 快照
export function buildNavSnapshot(positions: PositionExposureSummary[], totalRealized: number): NavSnapshot {
  const totalUnrealized = positions.reduce((sum, item) => sum + item.unrealizedPnlUsd, 0)
  const totalNotional = positions.reduce((sum, item) => sum + item.notionalUsd, 0)
  return {
    timestamp: Date.now(),
    totalRealizedPnlUsd: totalRealized,
    totalUnrealizedPnlUsd: totalUnrealized,
    totalNotionalUsd: totalNotional,
    positions
  }
}
