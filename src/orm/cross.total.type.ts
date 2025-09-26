import { RowDataPacket } from "mysql2";

export type TCrossTotalDB = {
  timestamp: number
  totalDiffUsd: string
}

export interface ICrossTotalDBRes extends TCrossTotalDB, RowDataPacket {
  id: number
  createTime: Date
}
