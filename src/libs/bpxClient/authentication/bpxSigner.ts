import { default as util }  from "tweetnacl-util";
import { default as nacl } from 'tweetnacl';

const SIGNATURE_EXPIRATION_TIME_MS = 60000;

export class BpxSigner {

  public static generateHttpAuthSignature(
    apiKey: string,
    apiSecret: string,
    instruction: string,
    body: Record<string, any>
  ): Record<string, string> {
    
    const bodyEntries = Object.entries(body)
      .filter(
        ([, value]) => value !== undefined && JSON.stringify(value) !== 'null'
      )
      .map(([k, v]) => [k, v.toString()])
      .sort(([a], [b]) => a.localeCompare(b));

    bodyEntries.unshift(['instruction', instruction]);

    const timestamp = String(Date.now());
    const window = String(SIGNATURE_EXPIRATION_TIME_MS);

    bodyEntries.push(['timestamp', timestamp], ['window', window]);

    const msg = bodyEntries.map(([k, v]) => `${k}=${v}`).join('&');
    const base64Signature = this.sign(msg, apiSecret);

    const headers = {
      'X-API-Key': apiKey,
      'X-Signature': base64Signature,
      'X-Timestamp': timestamp,
      'X-Window': window
    };
    
    return headers;
  }

  public static generateWsAuthSignature(
    apiKey: string,
    apiSecret: string
  ): string[] {

    const body: Record<string, any> = {
      instruction: 'subscribe', // fixed instruction for websocket
      timestamp: String(Date.now()),
      window: String(SIGNATURE_EXPIRATION_TIME_MS)
    };
    
    const msg = Object.entries(body)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    const base64Signature = this.sign(msg, apiSecret);
    
    const signature = [
      apiKey,
      base64Signature,
      body.timestamp,
      body.window
    ];

    return signature;
  }

  private static sign(msg: string, signingKey: string): string {
    const encodedMessage = new TextEncoder().encode(msg);
    const privateKey = util.decodeBase64(signingKey);
    
    const seed = privateKey.slice(0, 32);
    const keyPair = nacl.sign.keyPair.fromSeed(seed);
    const signature = nacl.sign.detached(encodedMessage, keyPair.secretKey);

    return util.encodeBase64(signature);
  }

}
