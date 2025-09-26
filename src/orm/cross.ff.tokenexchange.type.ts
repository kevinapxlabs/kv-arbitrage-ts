import { RowDataPacket } from "mysql2";

export type TFundingFeeTokenExchangeDB = {
  tokenId: number
  exchangeToken: string
  exchangeName: string
  cexId: number
  tokenType: number
  isDeleted: number
}

export interface IFundingFeeTokenExchangeDBRes extends TFundingFeeTokenExchangeDB, RowDataPacket {
  id: number
  createTime: Date
}
