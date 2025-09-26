import { Pool, ResultSetHeader } from 'mysql2'
import { IFundingFeeConfigDBRes, TFundingFeeConfigDB } from './cross.fundingfee.config.type.js'

export class FundingFeeConfigRep {
  pool: Pool
  reqKeys: string[]
  tableName = 'CROSS_FUNDING_FEE_CONFIG'

  constructor(pool: Pool) {
    this.pool = pool
    this.reqKeys = [
      'projectName', 'proKey', 'proValue'
    ]
  }

  async create(s: TFundingFeeConfigDB): Promise<ResultSetHeader> {
    const length = Array(this.reqKeys.length).fill('?')
    const sql = `INSERT INTO ${this.tableName} (${this.reqKeys.join(',')}) VALUES (${length})`
    return new Promise((resolve, reject) => {
      this.pool.query<ResultSetHeader>(
        sql,
        [ s.projectName, s.proKey, s.proValue ],
        (err, res) => {
          if (err) reject(err)
          else resolve(res)
        }
      )   
    })  
  }
  
  async queryByProjectName(projectName: string): Promise<IFundingFeeConfigDBRes[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE projectName = ?`
    return new Promise((resolve, reject) => {
      this.pool.query<IFundingFeeConfigDBRes[]>(sql, [ projectName ], (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  }
}
