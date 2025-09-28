import { RowDataPacket } from "mysql2";

export type TFundingFeeTokenDB = {
  chainToken: string
  grading: number
  isDeleted: number
}

export interface IFundingFeeTokenDBRes extends TFundingFeeTokenDB, RowDataPacket {
  id: number
  createTime: Date
}
