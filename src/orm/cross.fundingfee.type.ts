import { RowDataPacket } from "mysql2";

export type TCrossFundingFeeOrderDB = {
  timestamp: number
  projectId: number
  orderId: string
  symbol: string
  quantity: string
  orderReason: number
  exchangeName: string
  side: string
}

export interface ICrossFundingFeeOrderDBRes extends TCrossFundingFeeOrderDB, RowDataPacket {
  id: number
  createTime: Date
}
