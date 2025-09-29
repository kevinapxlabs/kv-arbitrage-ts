import { blogger } from "../common/base/logger.js"
import { sendMsg } from "../utils/bot.js"
import { ParamsMgr } from "./params.js"

let noDecreasePositionTimestamp = 0
let noDecreasePositionTimestamp2 = 0
let mainErrorTimestamp = 0

export class NoticeMgr {
  // 没有减仓时发送通知
  // 间隔时间为60s
  static sendNoDecreasePositiondMsg(traceId: string, msg: string) {
        const minSeconds = 60
    if (Date.now() - noDecreasePositionTimestamp < 1000 * minSeconds) {
      blogger.info(`${traceId} no decrease postion, msg ${msg} skiped, send interval less than ${minSeconds}s`)
      return
    }
    sendMsg(ParamsMgr.TG_NOTICE_NAME, msg)
    noDecreasePositionTimestamp = Date.now()
  }

  static sendNoDecreasePositiondMsg2(traceId: string, msg: string) {
    const minSeconds = 300
    if (Date.now() - noDecreasePositionTimestamp2 < 1000 * minSeconds) {
      blogger.info(`${traceId} no decrease postion2, msg ${msg} skiped, send interval less than ${minSeconds}s`)
      return
    }
    sendMsg(ParamsMgr.TG_NOTICE_NAME, msg)
    noDecreasePositionTimestamp2 = Date.now()
  }

  // 主进程错误时发送通知
  // 间隔时间为30s
  static sendMainErrorMsg(traceId: string, msg: string) {
    const minSeconds = 30
    if (Date.now() - mainErrorTimestamp < 1000 * minSeconds) {
      blogger.info(`${traceId} main error, msg ${msg} skiped, send interval less than ${minSeconds}s`)
      return
    }
    sendMsg(ParamsMgr.TG_NOTICE_NAME, msg)
    mainErrorTimestamp = Date.now()
  }
}