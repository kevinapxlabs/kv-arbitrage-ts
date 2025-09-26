import { Pool, ResultSetHeader } from 'mysql2'
import { IFundingFeeTokenExchangeDBRes, TFundingFeeTokenExchangeDB } from './cross.ff.tokenexchange.type.js'

export class FundingFeeTokenExchangeRep {
  pool: Pool
  reqKeys: string[]
  tableName = 'CROSS_FF_TOKEN_EXCHANGE'

  constructor(pool: Pool) {
    this.pool = pool
    this.reqKeys = [
      'tokenId', 'exchangeToken', 'exchangeName', 'cexId', 'tokenType', 'isDeleted'
    ]
  }

  // 插入
  async insert(s: TFundingFeeTokenExchangeDB): Promise<number> {
    const sql = `INSERT INTO ${this.tableName} (${this.reqKeys.join(',')}) VALUES (${this.reqKeys.map(() => '?').join(',')})`
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader>(sql, [s.tokenId, s.exchangeToken, s.exchangeName, s.cexId, s.tokenType, s.isDeleted], (err, res) => {
        if (err) reject(err)
        else resolve(res.insertId)
      })
    })
  }

  // 查询所有
  async getAll(): Promise<IFundingFeeTokenExchangeDBRes[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE isDeleted = 0`
    return new Promise((resolve, reject) => {
      this.pool.query<IFundingFeeTokenExchangeDBRes[]>(sql, [], (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  }

  // 根据tokenId和exchangeToken查询
  async queryByTokenIdAndCexId(tokenId: number, exchangeToken: string, cexId: number): Promise<IFundingFeeTokenExchangeDBRes[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE tokenId = ? AND exchangeToken = ? AND cexId = ?`
    return new Promise((resolve, reject) => {
      this.pool.query<IFundingFeeTokenExchangeDBRes[]>(sql, [tokenId, exchangeToken, cexId], (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  }
}
