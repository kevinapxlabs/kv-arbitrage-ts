import axios from 'axios';
import { ApiResponse, HttpMethod } from './common/api.types.js';
import { API_ENDPOINT_INSTRUCTION_MAP } from './instruction.js';
import { BpxSigner } from '../authentication/bpxSigner.js';
import { BpxCredentials } from '../authentication/bpxCredentials.js';

export class BpxHttpHandler {
  
  private httpUrl: string = 'https://api.backpack.exchange';
  private readonly debug: boolean;

  constructor(
    private readonly auth: BpxCredentials,
    opts: { httpUrl?: string, debug?: boolean } = {}
  ) {
    this.httpUrl = opts.httpUrl || this.httpUrl;
    this.debug = opts.debug || false;
  }

  async execute<T>(method: HttpMethod, uri: string, body?: Record<string, any>): Promise<ApiResponse<T>> {

    try {
      let url = uri;
      if (body && method === HttpMethod.GET) {
        const queryString = new URLSearchParams(
          Object.entries(body).map(([key, value]) => [key, String(value)])
        ).toString();
        url = `${uri}${url.includes('?') ? '&' : '?'}${queryString}`;
      }

      const instruction = API_ENDPOINT_INSTRUCTION_MAP[`${method}:${uri}`];

      // console.log('instruction : ', instruction);
      let headers: Record<string, string> = {};

      if (instruction) {

        const signedHeaders = BpxSigner.generateHttpAuthSignature(
          this.auth.verifyingKey,
          this.auth.signingKey,
          instruction,
          body || {}
        );
        headers = signedHeaders;
      }

      if (method !== HttpMethod.GET) {
        headers['Content-Type'] = 'application/json';
      }

      if (this.debug) {
        console.log('=== [Debug] HTTP Request ===');
        console.log('URL:', `${this.httpUrl}${url}`);
        console.log('Method:', method);
        console.log('Headers:', headers);
        if (body) {
          if (method === 'GET') {
            console.log('Query Parameters:', body);
          } else {
            console.log('Request Body:', body);
          }
        }
      }

      const response = await axios.request({
        url: `${this.httpUrl}${url}`,
        method,
        headers,
        ...(method !== HttpMethod.GET && body ? { data: JSON.stringify(body) } : {}),
        validateStatus: () => true
      });

      const data = response.data
      
      if (this.debug) {
        console.log('=== [Debug] HTTP Response ===');
        console.log('Status:', response.status);
        console.log('Response Headers:', response.headers);
        console.log('Response Data:', data);
        console.log('=========================');
      }
      if (response.status >= 300) {
        return {
          statusCode: response.status,
          data: {},
          error: {
            code: data.code || 'UNKNOWN_ERROR',
            message: data.message || 'Unknown error occurred'
          }
        };
      }

      return {
        statusCode: 200,
        data: data as T,
        error: {}
      };
    } catch (error) {
      if (this.debug) {
        console.log('=== [Debug] Error ===');
        console.log('Error:', error);
        console.log('=====================');
      }
      return {
        statusCode: 500,
        data: {},
        error: {
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  }

}

export function isSuccess<T>(response: ApiResponse<T>): response is ApiResponse<T> & { data: T; error: Record<string, never> } {
  return response.statusCode === 200;
}

export * from './common/api.types.js'; 