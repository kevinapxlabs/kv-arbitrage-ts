import { RowDataPacket } from "mysql2";

export type TFundingFeeHistoryDB = {
  timestamp: number
  symbol: string
  quantity: string
  projectId: number
  exchangeName: string
}

export interface IFundingFeeHistoryDBRes extends TFundingFeeHistoryDB, RowDataPacket {
  id: number
  createTime: Date
}
