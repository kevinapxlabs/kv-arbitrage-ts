import axios, { AxiosInstance, AxiosRequestConfig, Method, RawAxiosRequestHeaders } from 'axios';
import { KeyObject, createPrivateKey, sign as signMessage } from 'crypto';
import { URLSearchParams } from 'url';

export interface BackpackClientConfig {
  apiKey?: string;
  privateKey?: string | Buffer | Uint8Array | KeyObject;
  baseURL?: string;
  timeout?: number;
  window?: number;
  brokerId?: number;
  defaultHeaders?: RawAxiosRequestHeaders;
  timestampProvider?: () => number;
}

export interface BackpackRequestOptions {
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: RawAxiosRequestHeaders;
  signed?: boolean;
  instruction?: string;
  useApiKey?: boolean;
  windowMs?: number;
  timestamp?: number;
}

const DEFAULT_BASE_URL = 'https://api.backpack.exchange';
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_WINDOW = 5000;

type InstructionMap = Record<string, string>;

const BACKPACK_INSTRUCTIONS: InstructionMap = {
  'GET /api/v1/account': 'accountQuery',
  'PATCH /api/v1/account': 'accountUpdate',
  'POST /api/v1/account/convertDust': 'convertDust',
  'GET /api/v1/account/limits/borrow': 'maxBorrowQuantity',
  'GET /api/v1/account/limits/order': 'maxOrderQuantity',
  'GET /api/v1/account/limits/withdrawal': 'maxWithdrawalQuantity',
  'GET /api/v1/borrowLend/positions': 'borrowLendPositionQuery',
  'POST /api/v1/borrowLend': 'borrowLendExecute',
  'GET /api/v1/capital': 'balanceQuery',
  'GET /api/v1/capital/collateral': 'collateralQuery',
  'GET /wapi/v1/capital/deposits': 'depositQueryAll',
  'GET /wapi/v1/capital/deposit/address': 'depositAddressQuery',
  'GET /api/v1/order': 'orderQuery',
  'POST /api/v1/order': 'orderExecute',
  'DELETE /api/v1/order': 'orderCancel',
  'POST /api/v1/orders': 'orderExecute',
  'GET /api/v1/orders': 'orderQueryAll',
  'DELETE /api/v1/orders': 'orderCancelAll',
  'GET /api/v1/position': 'positionQuery',
  'POST /api/v1/rfq': 'rfqSubmit',
  'POST /api/v1/rfq/accept': 'quoteAccept',
  'POST /api/v1/rfq/refresh': 'rfqRefresh',
  'POST /api/v1/rfq/cancel': 'rfqCancel',
  'POST /api/v1/rfq/quote': 'quoteSubmit',
  'GET /api/v1/strategy': 'strategyQuery',
  'POST /api/v1/strategy': 'strategyCreate',
  'DELETE /api/v1/strategy': 'strategyCancel',
  'GET /api/v1/strategies': 'strategyQueryAll',
  'DELETE /api/v1/strategies': 'strategyCancelAll',
  'GET /wapi/v1/capital/withdrawals': 'withdrawalQueryAll',
  'POST /wapi/v1/capital/withdrawals': 'withdraw',
  'GET /wapi/v1/history/borrowLend': 'borrowHistoryQueryAll',
  'GET /wapi/v1/history/interest': 'interestHistoryQueryAll',
  'GET /wapi/v1/history/borrowLend/positions': 'borrowPositionHistoryQueryAll',
  'GET /wapi/v1/history/dust': 'dustHistoryQueryAll',
  'GET /wapi/v1/history/fills': 'fillHistoryQueryAll',
  'GET /wapi/v1/history/funding': 'fundingHistoryQueryAll',
  'GET /wapi/v1/history/orders': 'orderHistoryQueryAll',
  'GET /wapi/v1/history/rfq': 'rfqHistoryQueryAll',
  'GET /wapi/v1/history/quote': 'quoteHistoryQueryAll',
  'GET /wapi/v1/history/settlement': 'settlementHistoryQueryAll',
  'GET /wapi/v1/history/strategies': 'strategyHistoryQueryAll',
};

export class BackpackApiBase {
  protected readonly axiosInstance: AxiosInstance;
  protected readonly apiKey?: string;
  protected readonly brokerId?: number;
  protected readonly defaultHeaders: RawAxiosRequestHeaders;
  protected readonly defaultWindow: number;
  private readonly privateKey?: KeyObject;
  private readonly timestampProvider: () => number;

  constructor(config: BackpackClientConfig = {}) {
    this.apiKey = config.apiKey;
    this.privateKey = this.normalizePrivateKey(config.privateKey);
    this.defaultWindow = config.window ?? DEFAULT_WINDOW;
    this.brokerId = config.brokerId;
    this.defaultHeaders = { ...(config.defaultHeaders ?? {}) };
    this.timestampProvider = config.timestampProvider ?? (() => Date.now());
    this.axiosInstance = axios.create({
      baseURL: config.baseURL ?? DEFAULT_BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      headers: this.defaultHeaders,
    });
  }

  protected async request<T>(method: Method, path: string, options: BackpackRequestOptions = {}): Promise<T> {
    const { params, data, headers, signed, instruction, useApiKey, windowMs, timestamp } = options;
    const requestHeaders: RawAxiosRequestHeaders = { ...(headers ?? {}) };
    let url = path;

    if (params && Object.keys(params).length > 0) {
      const query = this.buildQueryString(params);
      if (query) {
        url = `${path}?${query}`;
      }
    }

    if (signed) {
      const resolvedInstruction = instruction ?? this.lookupInstruction(method, path);
      if (!resolvedInstruction) {
        throw new Error(`Backpack instruction required for signed request ${method} ${path}`);
      }
      const timestampValue = timestamp ?? this.timestampProvider();
      const windowValue = windowMs ?? this.defaultWindow;
      const signingPayload = this.buildSigningPayload(resolvedInstruction, params, data, timestampValue, windowValue);
      const signature = this.sign(signingPayload);
      requestHeaders['X-TIMESTAMP'] = String(timestampValue);
      requestHeaders['X-WINDOW'] = String(windowValue);
      requestHeaders['X-SIGNATURE'] = signature;
      requestHeaders['X-API-KEY'] = this.requireApiKey();
      if (this.brokerId !== undefined && requestHeaders['X-BROKER-ID'] === undefined) {
        requestHeaders['X-BROKER-ID'] = String(this.brokerId);
      }
    } else if (useApiKey) {
      requestHeaders['X-API-KEY'] = this.requireApiKey();
    }

    const axiosConfig: AxiosRequestConfig = {
      method,
      url,
      data,
      headers: requestHeaders,
      validateStatus: () => true,
    };

    const response = await this.axiosInstance.request<T>(axiosConfig);
    if (response.status >= 200 && response.status < 300) {
      return response.data as T;
    }
    const errorBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    throw new Error(`Backpack request failed (${response.status}): ${errorBody}`);
  }

  protected async getPublic<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('GET', path, { params });
  }

  protected async getSigned<T>(path: string, params?: Record<string, unknown>, instruction?: string): Promise<T> {
    return this.request<T>('GET', path, { params, signed: true, instruction });
  }

  protected async postSigned<T>(path: string, data?: unknown, instruction?: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', path, { data, params, signed: true, instruction });
  }

  protected async postPublic<T>(path: string, data?: unknown, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', path, { data, params });
  }

  protected async deleteSigned<T>(path: string, data?: unknown, instruction?: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('DELETE', path, { data, params, signed: true, instruction });
  }

  protected async patchSigned<T>(path: string, data?: unknown, instruction?: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('PATCH', path, { data, params, signed: true, instruction });
  }

  private buildQueryString(params: Record<string, unknown>): string {
    const searchParams = new URLSearchParams();
    for (const [key, value] of this.normalizeKeyValuePairs(params)) {
      searchParams.append(key, value);
    }
    return searchParams.toString();
  }

  private buildSigningPayload(
    instruction: string,
    params: Record<string, unknown> | undefined,
    data: unknown,
    timestamp: number,
    window: number
  ): string {
    const segments: string[] = [];
    const targets = this.collectSigningTargets(params, data);
    if (targets.length === 0) {
      segments.push(`instruction=${instruction}`);
    } else {
      for (const target of targets) {
        const payload = this.objectToSigningString(target);
        segments.push(payload ? `instruction=${instruction}&${payload}` : `instruction=${instruction}`);
      }
    }
    const prefix = segments.join('&');
    const suffix = `timestamp=${timestamp}&window=${window}`;
    return prefix ? `${prefix}&${suffix}` : suffix;
  }

  private collectSigningTargets(
    params: Record<string, unknown> | undefined,
    data: unknown
  ): Record<string, unknown>[] {
    if (Array.isArray(data)) {
      return data.map((item) => this.ensureObject(item, 'array payload item'));
    }
    const merged: Record<string, unknown> = {};
    if (params) {
      Object.assign(merged, params);
    }
    if (data && typeof data === 'object') {
      Object.assign(merged, data as Record<string, unknown>);
    }
    if (Object.keys(merged).length === 0) {
      return [];
    }
    return [merged];
  }

  private normalizeKeyValuePairs(source: Record<string, unknown>): [string, string][] {
    const entries: [string, string][] = [];
    const keys = Object.keys(source).sort();
    for (const key of keys) {
      const value = source[key];
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item === undefined || item === null) {
            continue;
          }
          entries.push([key, this.stringifyValue(item)]);
        }
        continue;
      }
      entries.push([key, this.stringifyValue(value)]);
    }
    return entries;
  }

  private objectToSigningString(source: Record<string, unknown>): string {
    return this.normalizeKeyValuePairs(source)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  private stringifyValue(value: unknown): string {
    if (value instanceof Date) {
      return String(value.valueOf());
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value);
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private sign(payload: string): string {
    if (!this.privateKey) {
      throw new Error('Backpack private endpoints require a private key');
    }
    const signature = signMessage(null, Buffer.from(payload, 'utf8'), this.privateKey);
    return signature.toString('base64');
  }

  private lookupInstruction(method: Method, path: string): string | undefined {
    const key = `${method.toUpperCase()} ${path}`;
    return BACKPACK_INSTRUCTIONS[key];
  }

  private requireApiKey(): string {
    if (!this.apiKey) {
      throw new Error('Backpack private endpoints require apiKey');
    }
    return this.apiKey;
  }

  private normalizePrivateKey(key?: string | Buffer | Uint8Array | KeyObject): KeyObject | undefined {
    if (!key) {
      return undefined;
    }
    if (key instanceof KeyObject) {
      return key;
    }
    if (typeof key === 'string' && key.includes('BEGIN')) {
      return createPrivateKey(key);
    }
    const buffer = typeof key === 'string' ? Buffer.from(key, 'base64') : Buffer.from(key);
    if (buffer.length === 0) {
      throw new Error('Backpack private key cannot be empty');
    }
    if (buffer.length !== 32 && buffer.length !== 64) {
      throw new Error('Backpack private key must be 32 or 64 bytes when provided as raw bytes');
    }
    const seed = buffer.length === 32 ? buffer : buffer.slice(0, 32);
    const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
    const der = Buffer.concat([pkcs8Prefix, seed]);
    const pem = `-----BEGIN PRIVATE KEY-----\n${der.toString('base64').match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----\n`;
    return createPrivateKey({ key: pem, format: 'pem' });
  }

  private ensureObject(value: unknown, context: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Expected object for ${context}`);
    }
    return { ...(value as Record<string, unknown>) };
  }
}
