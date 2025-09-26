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

export type ExchangeFees = {
  makerBps: number
  takerBps: number
}

export type ExchangeRuntimeConfig = {
  id: string
  type: string
  enabled?: boolean
  apiKey?: string
  apiSecret?: string
  apiPassphrase?: string
  orderbookKeyPattern?: string
  settlementAsset?: string
  fees?: ExchangeFees
}

export type ArbitrageOrderBookConfig = {
  keyPattern: string
  staleThresholdMs: number
}

export type ArbitrageRiskConfig = {
  maxMarginLossRatio: number
  liquidationBufferBps: number
  forceCloseSpreadBps: number
  maxHedgeImbalanceBps: number
}

export type ArbitrageRuntimeConfig = {
  tokenListPath: string
  checkIntervalMs: number
  navReportIntervalMs: number
  leverage: number
  defaultOpenSpreadBps: number
  defaultCloseSpreadBps: number
  minCloseSpreadBps: number
  closeSpreadDecayMinutes: number
  defaultMinTradeSize: number
  defaultTradeSize: number
  defaultMaxNetPosition: number
  defaultMaxNotionalUsd: number
  maxHoldingMinutes: number
  maxSimultaneousPositions: number
  orderSizeUsd: number
  orderBook: ArbitrageOrderBookConfig
  risk: ArbitrageRiskConfig
}

export type TDefiConfig = {
  redis: TRedis
  sentinelRedis?: TSentinelRedis
  mysql: TMysql
  bot: { [key: string]: BotInfo }
  projectName: string
  pwd: string
  exchanges?: ExchangeRuntimeConfig[]
  arbitrage?: ArbitrageRuntimeConfig
}

export const defiConfig: TDefiConfig = JSON.parse(readFileSync(config.get('config'), 'utf-8'))
