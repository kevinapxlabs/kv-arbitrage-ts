import { Pool, ResultSetHeader } from 'mysql2'
import { IFundingFeeHistoryDBRes, TFundingFeeHistoryDB } from './cross.fundingfee.history.type.js'

export class FundingFeeHistoryRep {
  pool: Pool
  reqKeys: string[]
  tableName = 'CROSS_FUNDING_FEE_HISTORY'

  constructor(pool: Pool) {
    this.pool = pool
    this.reqKeys = [
      'timestamp', 'symbol', 'quantity', 'projectId', 'exchangeName'
    ]
  }

  async create(s: TFundingFeeHistoryDB): Promise<ResultSetHeader> {
    const length = Array(this.reqKeys.length).fill('?')
    const sql = `INSERT INTO ${this.tableName} (${this.reqKeys.join(',')}) VALUES (${length})`
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader>(
        sql,
        [ s.timestamp, s.symbol, s.quantity, s.projectId, s.exchangeName ],
        (err, res) => {
          if (err) reject(err)
          else resolve(res)
        }
      )   
    })  
  }

  async multiCreate(ms: TFundingFeeHistoryDB[]): Promise<number> {
    const sql = `INSERT INTO ${this.tableName} (${this.reqKeys.join(',')}) VALUES ?`
    var values: any[] = []
    for (const s of ms) {
      values.push([
        s.timestamp, s.symbol, s.quantity, s.projectId, s.exchangeName
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

  async queryByTimestamp(timestamp: number): Promise<IFundingFeeHistoryDBRes[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE timestamp >= ?`
    return new Promise((resolve, reject) => {
      this.pool.query<IFundingFeeHistoryDBRes[]>(sql, [ timestamp ], (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  }

  async queryByTimestampAndProjectId(timestamp: number, projectId: number): Promise<IFundingFeeHistoryDBRes[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE timestamp >= ? AND projectId = ?`
    return new Promise((resolve, reject) => {
      this.pool.query<IFundingFeeHistoryDBRes[]>(sql, [ timestamp, projectId ], (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  }
}
