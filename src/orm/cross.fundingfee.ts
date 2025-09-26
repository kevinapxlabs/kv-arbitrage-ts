import { Pool, ResultSetHeader } from 'mysql2'
import { ICrossFundingFeeOrderDBRes, TCrossFundingFeeOrderDB } from './cross.fundingfee.type.js'

export class CrossFundingFeeOrderRep {
  pool: Pool
  reqKeys: string[]
  tableName = 'CROSS_FUNDING_FEE_ORDER'

  constructor(pool: Pool) {
    this.pool = pool
    this.reqKeys = [
      'timestamp', 'projectId', 'orderId', 'symbol', 'quantity',
      'orderReason', 'exchangeName', 'side'
    ]
  }

  async create(s: TCrossFundingFeeOrderDB): Promise<ResultSetHeader> {
    const length = Array(this.reqKeys.length).fill('?')
    const sql = `INSERT INTO ${this.tableName} (${this.reqKeys.join(',')}) VALUES (${length})`
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader>(
        sql,
        [ s.timestamp, s.projectId, s.orderId, s.symbol, s.quantity,
          s.orderReason, s.exchangeName, s.side
        ],
        (err, res) => {
          if (err) reject(err)
          else resolve(res)
        }
      )   
    })  
  }

  async queryByProjectId(projectId: number): Promise<ICrossFundingFeeOrderDBRes> {
    const timestamp = Math.floor(Date.now() / 1000) - 600
    const sql = `SELECT * FROM ${this.tableName} WHERE timestamp > ? AND projectId = ?`
    return new Promise((resolve, reject) => {
      this.pool.query<ICrossFundingFeeOrderDBRes[]>(sql, [timestamp, projectId], (err, res) => {
        if (err) reject(err)
        else resolve(res[0])
      })
    })
  }

  async queryByTimestamp(timestamp: number): Promise<ICrossFundingFeeOrderDBRes[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE timestamp >= ?`
    return new Promise((resolve, reject) => {
      this.pool.query<ICrossFundingFeeOrderDBRes[]>(sql, [timestamp], (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  }
}
