import { Pool, ResultSetHeader } from 'mysql2'
import { IArbitrageConfigDBRes, TArbitrageConfigDB } from './arbitrage.config.type.js'

export class ArbitrageConfigRep {
  pool: Pool
  reqKeys: string[]
  tableName = 'ARBITRAGE_CONFIG'

  constructor(pool: Pool) {
    this.pool = pool
    this.reqKeys = [
      'projectName', 'proKey', 'proValue'
    ]
  }

  async create(s: TArbitrageConfigDB): Promise<ResultSetHeader> {
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
  
  async queryByProjectName(projectName: string): Promise<IArbitrageConfigDBRes[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE projectName = ?`
    return new Promise((resolve, reject) => {
      this.pool.query<IArbitrageConfigDBRes[]>(sql, [ projectName ], (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
    })
  }
}
