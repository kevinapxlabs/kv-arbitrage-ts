import { ArbitrageManage } from "../arbitrage/manage.js";

const arbitrageManage = new ArbitrageManage();
export const arbitrageTask = async () => {
  await arbitrageManage.run();
};
