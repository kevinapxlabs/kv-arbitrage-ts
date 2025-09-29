import { HttpMethod } from '../../common/api.types.js';
import { StatusAndMessage } from './system.types.js';
import { BpxHttpHandler } from '../../bpxHttpHandler.js';

export class SystemApi {

    constructor(private httpHandler: BpxHttpHandler) {}

  // https://docs.backpack.exchange/#tag/System/operation/get_status
  async status() {
      return this.httpHandler.execute<StatusAndMessage>(HttpMethod.GET, '/api/v1/status');
  }

  // https://docs.backpack.exchange/#tag/System/operation/ping
  async ping() {
      return this.httpHandler.execute<string>(HttpMethod.GET, '/api/v1/ping');
  }

  // https://docs.backpack.exchange/#tag/System/operation/get_time
  async getSystemTime() {
      return this.httpHandler.execute<string>(HttpMethod.GET, '/api/v1/time');
  }

}