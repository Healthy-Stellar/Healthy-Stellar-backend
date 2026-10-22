import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

@Injectable()
export class RedisLockService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  private logger = new Logger(RedisLockService.name);
  private readonly tokens = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      maxRetriesPerRequest: null,
      retryStrategy: (times: number) => {
        this.logger.error(`[Redis Lock] Connection attempt ${times} failed.`);
        if (times >= 10) {
          this.logger.error(`[Redis Lock] Max connection retries (10) exhausted. Exiting...`);
          process.exit(1);
        }
        return 3000;
      },
    });
  }

  onModuleDestroy(): void {
    if (this.redis) {
      this.redis.disconnect();
    }
  }

  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    const token = randomUUID();
    const result = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    if (result === 'OK') {
      this.tokens.set(key, token);
      return true;
    }
    return false;
  }

  async releaseLock(key: string): Promise<void> {
    const token = this.tokens.get(key);
    if (!token) {
      return;
    }
    try {
      await this.redis.eval(RELEASE_SCRIPT, 1, key, token);
    } finally {
      this.tokens.delete(key);
    }
  }
}
