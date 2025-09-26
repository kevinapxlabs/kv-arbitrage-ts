import { RowDataPacket } from "mysql2";

export type TCrossTotalDetailDB = {
  timestamp: number
  totalId: number
  baseToken: string
  diffUsd: string
  exchangeName: string
}

export interface ICrossTotalDetailDBRes extends TCrossTotalDetailDB, RowDataPacket {
  id: number
  createTime: Date
}
