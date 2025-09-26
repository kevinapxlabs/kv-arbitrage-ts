import { Pool, ResultSetHeader } from 'mysql2'
import { IBuyBasedTokenDBRes, TBuyBasedTokenDB } from './cross.basedtoken.type.js'

export class BuyBasedTokenRep {
  pool: Pool
  reqKeys: string[]
  tableName = 'CROSS_FF_BUY_BASED_TOKEN'

  constructor(pool: Pool) {
    this.pool = pool
    this.reqKeys = [
      'timestamp', 'cexId', 'basedToken', 'exchangeName', 'status'
    ]
  }

  // 插入
  async insert(s: TBuyBasedTokenDB): Promise<number> {
    const sql = `INSERT INTO ${this.tableName} (${this.reqKeys.join(',')}) VALUES (${this.reqKeys.map(() => '?').join(',')})`
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader>(sql, [s.timestamp, s.cexId, s.basedToken, s.exchangeName, s.status], (err, res) => {
        if (err) reject(err)
        else resolve(res.insertId)
      })
    })
  }

  // 根据 cexId 查询, 最近48小时的数据
  async queryByCexId(cexId: number): Promise<IBuyBasedTokenDBRes[]> {
    const timestamp = Math.floor(Date.now() / 1000) - 48 * 60 * 60
    const sql = `SELECT * FROM ${this.tableName} WHERE cexId = ? AND timestamp > ? ORDER BY id DESC`
    return new Promise((resolve, reject) => {
      this.pool.query<IBuyBasedTokenDBRes[]>(sql, [cexId, timestamp], (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  }

  // 更新状态
  async update(id: number, status: number): Promise<number> {
    const sql = `UPDATE ${this.tableName} SET status = ? WHERE id = ?`
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader>(sql, [status, id], (err, res) => {
        if (err) reject(err)
        else resolve(res.affectedRows)
      })
    })
  }
}
