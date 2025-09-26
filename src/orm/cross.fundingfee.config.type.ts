import { RowDataPacket } from "mysql2";

export type TFundingFeeConfigDB = {
  projectName: string
  proKey: string
  proValue: string
}

export interface IFundingFeeConfigDBRes extends TFundingFeeConfigDB, RowDataPacket {
  id: number
  createTime: Date
  updateTime: Date
}
