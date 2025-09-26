import { Pool, ResultSetHeader } from 'mysql2'
import { TCrossTotalDB } from './cross.total.type.js'

export class CrossTotalRep {
  pool: Pool
  reqKeys: string[]
  tableName = 'CROSS_FF_TOTAL'

  constructor(pool: Pool) {
    this.pool = pool
    this.reqKeys = [
      'timestamp', 'totalDiffUsd'
    ]
  }

  async create(s: TCrossTotalDB): Promise<ResultSetHeader> {
    const length = Array(this.reqKeys.length).fill('?')
    const sql = `INSERT INTO ${this.tableName} (${this.reqKeys.join(',')}) VALUES (${length})`
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader>(
        sql,
        [ s.timestamp, s.totalDiffUsd ],
        (err, res) => {
          if (err) reject(err)
          else resolve(res)
        }
      )   
    })  
  }
}
