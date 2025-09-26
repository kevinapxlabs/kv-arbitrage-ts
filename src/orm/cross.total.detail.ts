import { Pool, ResultSetHeader } from 'mysql2'
import { TCrossTotalDetailDB } from './cross.total.detail.type.js'

export class CrossTotalDetailRep {
  pool: Pool
  reqKeys: string[]
  tableName = 'CROSS_FF_TOTAL_DETAIL'

  constructor(pool: Pool) {
    this.pool = pool
    this.reqKeys = [
      'timestamp', 'totalId', 'baseToken', 'diffUsd', 'exchangeName'
    ]
  }

  async multiCreate(ms: TCrossTotalDetailDB[]): Promise<number> {
    const sql = `INSERT INTO ${this.tableName} (${this.reqKeys.join(',')}) VALUES ?`
    var values: any[] = []
    for (const s of ms) {
      values.push([
        s.timestamp, s.totalId, s.baseToken, s.diffUsd, s.exchangeName
      ])
    }
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader>(
        sql,
        [ values ],
        (err, res) => {
          if (err) reject(err)
          else resolve(res.affectedRows)
        }
      )
    })
  }
}
