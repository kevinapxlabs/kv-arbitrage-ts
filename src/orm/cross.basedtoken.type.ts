import { RowDataPacket } from "mysql2";

export type TBuyBasedTokenDB = {
  timestamp: number
  cexId: number
  basedToken: string
  exchangeName: string
  status: number
}

export interface IBuyBasedTokenDBRes extends TBuyBasedTokenDB, RowDataPacket {
  id: number
  createTime: Date
}
