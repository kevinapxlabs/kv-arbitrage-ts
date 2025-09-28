import { RowDataPacket } from "mysql2";

export type TArbitrageConfigDB = {
  projectName: string
  proKey: string
  proValue: string
}

export interface IArbitrageConfigDBRes extends TArbitrageConfigDB, RowDataPacket {
  id: number
  createTime: Date
  updateTime: Date
}
