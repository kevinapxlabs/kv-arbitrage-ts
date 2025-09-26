import CryptoJS from 'crypto-js'

export class AESCipher {
  key: string
  iv: string
  block_size = 16
  algorithm = 'aes-128-cbc';

  constructor(key: string) {
    this.key = `${key}4438`       // 密钥
    this.iv = 'TRADE-AES0000000'  // 偏移量
  }

  encrypt(plainText: string): string {
    const key = CryptoJS.enc.Utf8.parse(this.key)
    const iv = CryptoJS.enc.Utf8.parse(this.iv)
    const data = CryptoJS.AES.encrypt(plainText, key, {
      iv
    })
    return data.ciphertext.toString(CryptoJS.enc.Base64)
  }

  decrypt(encryptedText: string): string {
    const key = CryptoJS.enc.Utf8.parse(this.key)
    const iv = CryptoJS.enc.Utf8.parse(this.iv)
    const data = CryptoJS.AES.decrypt(encryptedText, key, {
      iv
    })
    return data.toString(CryptoJS.enc.Utf8)
  }
}