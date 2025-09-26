import { blogger } from "../common/base/logger.js";
import { AESCipher } from "./blockin.cipher.js";

export type TBNKey = {
  apiKey: string
  secret: string
  passPhrase: string
}

export function getKeyInfo(apiKey: string, apiSecret: string, _passPhrase: string, pwd: string): TBNKey {
  try {
    // 解密
    const aes = new AESCipher(`${pwd}1114`)
    const secret = aes.decrypt(apiSecret)
    let passPhrase = _passPhrase
    if (passPhrase) {
      passPhrase = aes.decrypt(_passPhrase)
    }
    return {
      apiKey,
      secret,
      passPhrase
    }
  } catch(error) {
    const msg = `get banance key info error, error: ${error}`
    blogger.error(msg)
    throw new Error(msg)
  }
}
