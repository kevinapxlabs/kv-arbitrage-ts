import cron from 'node-cron'
import { arbitrageTask } from "./shedule/arbitrage.js";
import { sendMsg } from './utils/bot.js';
import { ParamsMgr } from './arbitrage/params.js';

// 每2秒执行一次 arbitrage 的数据管理任务
cron.schedule('*/3 * * * * *', arbitrageTask);

(async () => {
  // await arbitrageTask()
  await sendMsg(ParamsMgr.TG_NOTICE_NAME, 'arbitrage server start')
})();