import { HttpMethod } from '../../common/api.types.js';
import { FuturePositionWithMargin } from './futures.types.js';
import { BpxHttpHandler } from '../../bpxHttpHandler.js';

export class FuturesApi {

  constructor(private httpHandler: BpxHttpHandler) {}

  // https://docs.backpack.exchange/#tag/Futures/operation/get_positions
  async getOpenPositions() {
    return this.httpHandler.execute<FuturePositionWithMargin[]>(HttpMethod.GET, '/api/v1/position');
  }

}