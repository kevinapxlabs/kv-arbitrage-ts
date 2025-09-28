import config from 'config';
import { readFileSync } from 'fs';

export type TRedis = {
  url: string
}

export type TSentinelRedis = {
  sentinels: any[]
  name: string
  password: string
}

export type TMysql = {
  host: string
  user: string
  password: string
  port: number
  database: string
}

export type BotInfo = {
  token: string
  chatId: string
}

// Aster 配置
export type AsterCfg = {
  apiKey: string
  apiSecret: string
}
// Backpack 配置
export type BackpackCfg = {
  apiKey: string
  apiSecret: string
}

export type TDefiConfig = {
  redis: TRedis
  sentinelRedis?: TSentinelRedis
  mysql: TMysql
  bot: { [key: string]: BotInfo }
  projectName: string
  pwd: string
  exchangeIdList: number[]
  asterCfg: AsterCfg
  backpackCfg: BackpackCfg
}

export const defiConfig: TDefiConfig = JSON.parse(readFileSync(config.get('config'), 'utf-8'))
