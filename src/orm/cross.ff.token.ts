import { Pool, ResultSetHeader } from 'mysql2'
import { IFundingFeeTokenDBRes, TFundingFeeTokenDB } from './cross.ff.token.type.js'

export class FundingFeeTokenRep {
  pool: Pool
  reqKeys: string[]
  tableName = 'CROSS_FF_TOKEN'

  constructor(pool: Pool) {
    this.pool = pool
    this.reqKeys = [
      'chainToken', 'grading', 'isDeleted'
    ]
  }

  // 插入
  async insert(s: TFundingFeeTokenDB): Promise<number> {
    const sql = `INSERT INTO ${this.tableName} (${this.reqKeys.join(',')}) VALUES (${this.reqKeys.map(() => '?').join(',')})`
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader>(sql, [s.chainToken, s.grading, s.isDeleted], (err, res) => {
        if (err) reject(err)
        else resolve(res.insertId)
      })
    })
  }

  // 查询所有
  async getAll(): Promise<IFundingFeeTokenDBRes[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE isDeleted = 0`
    return new Promise((resolve, reject) => {
      this.pool.query<IFundingFeeTokenDBRes[]>(sql, [], (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  }

  // 根据chainToken查询
  async queryByChainToken(chainToken: string): Promise<IFundingFeeTokenDBRes[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE chainToken = ?`
    return new Promise((resolve, reject) => {
      this.pool.query<IFundingFeeTokenDBRes[]>(sql, [chainToken], (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  }
}
