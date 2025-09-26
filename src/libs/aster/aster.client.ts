import axios, { AxiosInstance, AxiosRequestConfig, Method, RawAxiosRequestHeaders } from 'axios';
import { createHmac } from 'crypto';
import { URLSearchParams } from 'url';

export interface AsterClientConfig {
  apiKey?: string;
  apiSecret?: string;
  baseURL?: string;
  timeout?: number;
  recvWindow?: number;
}

export interface AsterRequestOptions {
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: RawAxiosRequestHeaders;
  signed?: boolean;
  useApiKey?: boolean;
}

const DEFAULT_BASE_URL = 'https://fapi.asterdex.com';
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_RECV_WINDOW = 5000;

export class AsterApiBase {
  protected readonly axiosInstance: AxiosInstance;
  protected readonly apiKey?: string;
  protected readonly apiSecret?: string;
  protected readonly recvWindow: number;

  constructor(config: AsterClientConfig = {}) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.recvWindow = config.recvWindow ?? DEFAULT_RECV_WINDOW;
    this.axiosInstance = axios.create({
      baseURL: config.baseURL ?? DEFAULT_BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    });
  }

  protected async request<T>(method: Method, path: string, options: AsterRequestOptions = {}): Promise<T> {
    const { params, data, headers, signed, useApiKey } = options;
    const requestHeaders: RawAxiosRequestHeaders = { ...(headers ?? {}) };
    let url = path;

    if (signed) {
      const signedParams = this.createSignedParams(params ?? {});
      url = `${path}?${signedParams.toString()}`;
      requestHeaders['X-MBX-APIKEY'] = this.requireApiKey();
    } else if (params && Object.keys(params).length > 0) {
      const query = this.buildQueryParams(params);
      const queryString = query.toString();
      url = queryString ? `${path}?${queryString}` : path;
    }

    if (!signed && useApiKey) {
      requestHeaders['X-MBX-APIKEY'] = this.requireApiKey();
    }

    const axiosConfig: AxiosRequestConfig = {
      method,
      url,
      headers: requestHeaders,
      data,
      validateStatus: () => true
    };

    const response = await this.axiosInstance.request<T>(axiosConfig);
    if (response.status === 200) {
      return response.data
    }
    throw new Error(`Alter http response status: ${response.status}, data: ${JSON.stringify(response.data)}`)
  }

  protected async getPublic<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('GET', path, { params });
  }

  protected async postPublic<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', path, { params });
  }

  protected async getSigned<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('GET', path, { params, signed: true });
  }

  protected async postSigned<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', path, { params, signed: true });
  }

  protected async deleteSigned<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('DELETE', path, { params, signed: true });
  }

  protected async putSigned<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>('PUT', path, { params, signed: true });
  }

  private buildQueryParams(params: Record<string, unknown>): URLSearchParams {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item === undefined || item === null) {
            return;
          }
          searchParams.append(key, this.stringifyValue(item));
        });
        return;
      }
      searchParams.append(key, this.stringifyValue(value));
    });
    return searchParams;
  }

  private stringifyValue(value: unknown): string {
    if (value instanceof Date) {
      return String(value.valueOf());
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private createSignedParams(params: Record<string, unknown>): URLSearchParams {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Aster private endpoints require apiKey and apiSecret.');
    }
    const payload: Record<string, unknown> = { ...params };
    if (payload.timestamp === undefined) {
      payload.timestamp = Date.now();
    }
    if (payload.recvWindow === undefined && this.recvWindow) {
      payload.recvWindow = this.recvWindow;
    }
    const searchParams = this.buildQueryParams(payload);
    const signature = createHmac('sha256', this.apiSecret)
      .update(searchParams.toString())
      .digest('hex');
    searchParams.append('signature', signature);
    return searchParams;
  }

  private requireApiKey(): string {
    if (!this.apiKey) {
      throw new Error('Aster private endpoints require apiKey.');
    }
    return this.apiKey;
  }
}
