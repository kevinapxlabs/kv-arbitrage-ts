import mysql from 'mysql2'
import { defiConfig } from '../../config/config.js'

export function createPool(): mysql.Pool {
  let myqlCfg = defiConfig.mysql
  const pool = mysql.createPool({
    host: myqlCfg.host,
    user: myqlCfg.user,
    password: myqlCfg.password,
    port: myqlCfg.port,
    database: myqlCfg.database
  })
  return pool
}

export const pool = createPool()
