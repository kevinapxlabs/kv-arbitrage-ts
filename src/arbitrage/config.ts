import { readFileSync } from 'fs'
import path from 'path'
import { defiConfig, ArbitrageRuntimeConfig, ExchangeRuntimeConfig } from '../config/config.js'
import { blogger } from '../common/base/logger.js'
import { TokenConfig, ExchangeId } from './types.js'

interface RawTokenListEntry {
  id: number
  cexID: number
  baseToken: string
  symbol?: string
}

const CEX_ID_TO_EXCHANGE: Record<number, ExchangeId> = {
  6: 'backpack',
  7: 'aster'
}

export interface LoadedArbitrageConfig {
  settings: ArbitrageRuntimeConfig
  exchanges: ExchangeRuntimeConfig[]
  tokens: TokenConfig[]
}

// 将相对路径转换为项目根目录下的绝对路径
function resolveFromProject(relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    return relativePath
  }
  return path.resolve(process.cwd(), relativePath)
}

// 根据交易所编号推导币对符号，优先使用显式配置
function resolveSymbolForExchange(cexId: number, baseToken: string, explicit?: string): string {
  if (explicit) {
    return explicit
  }
  const base = baseToken.toUpperCase()
  switch (cexId) {
    case 6:
      return `${base}_USDC_PERP`
    case 7:
      return `${base}USDT`
    default:
      throw new Error(`Unsupported cexID ${cexId} for base token ${base}`)
  }
}

// 读取并转换 tokenlist.json，输出带默认参数的 Token 配置
function loadTokenList(tokenFilePath: string, settings: ArbitrageRuntimeConfig): TokenConfig[] {
  const resolved = resolveFromProject(tokenFilePath)
  const raw = readFileSync(resolved, 'utf-8')
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error(`Token list malformed at ${resolved}`)
  }
  const entries = parsed as RawTokenListEntry[]
  if (entries.length === 0) {
    blogger.warn('token list is empty, arbitrage engine will be idle')
  }

  const grouped = new Map<string, RawTokenListEntry[]>()
  for (const entry of entries) {
    if (!entry.baseToken) {
      blogger.warn('token list entry missing baseToken', entry)
      continue
    }
    const base = entry.baseToken.toUpperCase()
    if (!grouped.has(base)) {
      grouped.set(base, [])
    }
    grouped.get(base)?.push(entry)
  }

  const tokens: TokenConfig[] = []
  const defaultMinTradeSize = settings.defaultMinTradeSize ?? 0
  const defaultTradeSize = settings.defaultTradeSize ?? defaultMinTradeSize
  const defaultMaxNetPosition = settings.defaultMaxNetPosition ?? Number.MAX_SAFE_INTEGER
  const defaultMaxNotional = settings.defaultMaxNotionalUsd ?? Number.MAX_SAFE_INTEGER

  grouped.forEach((tokenEntries, base) => {
    const exchangeSymbols: Record<ExchangeId, string> = {}
    const instrumentIds: Record<ExchangeId, number> = {}

    for (const entry of tokenEntries) {
      const cexId = Number(entry.cexID)
      const exchangeId = CEX_ID_TO_EXCHANGE[cexId]
      if (!exchangeId) {
        blogger.warn('unsupported cex id in token list', entry)
        continue
      }
      try {
        const symbol = resolveSymbolForExchange(cexId, base, entry.symbol)
        exchangeSymbols[exchangeId] = symbol
        if (typeof entry.id === 'number') {
          instrumentIds[exchangeId] = entry.id
        }
      } catch (error) {
        blogger.warn('failed to resolve symbol for token entry', entry, error)
      }
    }

    if (Object.keys(exchangeSymbols).length === 0) {
      blogger.warn('no exchange mappings found for base token', base)
      return
    }

    const token: TokenConfig = {
      symbol: `${base}USDT`,
      base,
      quote: 'USDT',
      minTradeSize: defaultMinTradeSize,
      tradeSize: defaultTradeSize,
      maxNetPosition: defaultMaxNetPosition,
      maxNotionalUsd: defaultMaxNotional,
      openSpreadBps: settings.defaultOpenSpreadBps,
      closeSpreadBps: settings.defaultCloseSpreadBps,
      minCloseSpreadBps: settings.minCloseSpreadBps,
      closeSpreadDecayMinutes: settings.closeSpreadDecayMinutes,
      exchangeSymbols,
      instrumentIds: Object.keys(instrumentIds).length > 0 ? instrumentIds : undefined
    }

    tokens.push(token)
  })

  return tokens
}

// 加载套利所需的总配置（基础配置 + 交易所 + 币种）
export function loadArbitrageConfig(): LoadedArbitrageConfig {
  if (!defiConfig.arbitrage) {
    throw new Error('arbitrage configuration missing under defiConfig')
  }

  const settings = defiConfig.arbitrage
  const exchanges = (defiConfig.exchanges ?? []).filter((ex) => ex.enabled !== false)
  const tokens = loadTokenList(settings.tokenListPath, settings)

  if (exchanges.length < 2) {
    blogger.warn('less than two exchanges enabled, cross exchange flow will be limited')
  }

  return {
    settings,
    exchanges,
    tokens
  }
}

// 获取指定交易所对应的币对映射
export function resolveExchangeSymbol(token: TokenConfig, exchangeId: string): string | undefined {
  return token.exchangeSymbols[exchangeId]
}

export const ARBITRAGE_CONFIG = loadArbitrageConfig()
