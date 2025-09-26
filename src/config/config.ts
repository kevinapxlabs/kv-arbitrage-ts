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

export type TDefiConfig = {
  redis: TRedis
  sentinelRedis: TSentinelRedis
  mysql: TMysql
  bot: { [key: string]: BotInfo }
  projectName: string
  pwd: string
}

export const defiConfig: TDefiConfig = JSON.parse(readFileSync(config.get('config'), 'utf-8'))
