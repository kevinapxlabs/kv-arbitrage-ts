import { TokenConfig } from './types.js'

// 提供币种配置的查询能力
export class TokenRegistry {
  private readonly tokensBySymbol = new Map<string, TokenConfig>()

  constructor(tokens: TokenConfig[]) {
    tokens.forEach((token) => {
      this.tokensBySymbol.set(token.symbol, token)
    })
  }

  // 返回全部币种配置
  getAll(): TokenConfig[] {
    return Array.from(this.tokensBySymbol.values())
  }

  // 根据 symbol 获取币种配置
  get(symbol: string): TokenConfig | undefined {
    return this.tokensBySymbol.get(symbol)
  }
}
