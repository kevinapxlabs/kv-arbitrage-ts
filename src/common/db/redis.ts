import { Redis } from "ioredis"
import { defiConfig, TSentinelRedis } from '../../config/config.js'
import { blogger } from '../base/logger.js'

export class DefiRedis {
  redisCli
  
  constructor(url: string, sentinelCfg?: TSentinelRedis) {
    if (sentinelCfg !== undefined) {
      this.redisCli = new Redis(sentinelCfg);
    } else if (!url.startsWith('redis')) {
      let buffer = Buffer.from(url, 'base64');
      url = buffer.toString();
      this.redisCli = new Redis(url);
    } else {
      this.redisCli = new Redis(url);
    }

    // 配置redis监听事件
    this.redisCli.on('ready', () => {
      blogger.info('redis is ready');
    });

    this.redisCli.on('connect', () => {
      blogger.info('redis is now connected');
    });

    this.redisCli.on('error', (err: any) => {
      blogger.error('redis error:', err);
    });
  }

  async set(key: string, value: string, expire: number) {
    return await this.redisCli.set(key, value, 'EX', expire );
  }

  async get(key: string) {
    return await this.redisCli.get(key);
  }

  async del(key: string) {
    return await this.redisCli.del(key);
  }

  async sadd(key: string, value: string): Promise<number> {
    return await this.redisCli.sadd(key, value);
  }

  async spop(key: string): Promise<string | null> {
    return await this.redisCli.spop(key);
  }

  // publish message to channel
  async publish(channel: string, message: string) {
    return await this.redisCli.publish(channel, message);
  }

  async disconnect() {
    this.redisCli.disconnect()
  }

  async lock(lockKey: string, expire: number): Promise<string|null> {
    const timestamp = new Date().getTime() / 1000 | 0
    // 防止死锁
    const content = await this.redisCli.get(lockKey)
    if (content && timestamp - parseInt(content) > expire) {
      await this.unlock(lockKey)
    }
    return this.redisCli.set(lockKey, timestamp, 'EX', expire, 'NX')
  }

  async unlock(lockKey: string) {
    return this.redisCli.del(lockKey)
  }
}

function rdsConnect(): DefiRedis {
  const rdsCfg = defiConfig.redis
  const sentinelCfg = defiConfig.sentinelRedis
  const url = rdsCfg.url
  return new DefiRedis(url, sentinelCfg)
}

export const rdsClient = rdsConnect()
