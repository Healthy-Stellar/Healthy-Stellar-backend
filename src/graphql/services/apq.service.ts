import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { createHash } from 'crypto';

export interface PersistedQuery {
  hash: string;
  query: string;
}

@Injectable()
export class ApqService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  private readonly PREFIX = 'apq:';
  private readonly TTL_SECONDS = 86400 * 30;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD;

    if (redisUrl) {
      this.redis = new Redis(redisUrl);
    } else {
      this.redis = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword || undefined,
      });
    }
  }

  onModuleDestroy() {
    if (this.redis) {
      this.redis.disconnect();
    }
  }

  hashQuery(query: string): string {
    return createHash('sha256').update(query).digest('hex');
  }

  async storeQuery(hash: string, query: string): Promise<void> {
    await this.redis.setex(`${this.PREFIX}${hash}`, this.TTL_SECONDS, query);
  }

  async getQuery(hash: string): Promise<string | null> {
    return await this.redis.get(`${this.PREFIX}${hash}`);
  }

  async exists(hash: string): Promise<boolean> {
    const result = await this.redis.exists(`${this.PREFIX}${hash}`);
    return result === 1;
  }

  async registerQuery(query: string): Promise<PersistedQuery> {
    const hash = this.hashQuery(query);
    await this.storeQuery(hash, query);
    return { hash, query };
  }

  async registerQueries(queries: string[]): Promise<PersistedQuery[]> {
    const results: PersistedQuery[] = [];
    for (const query of queries) {
      const hash = this.hashQuery(query);
      await this.storeQuery(hash, query);
      results.push({ hash, query });
    }
    return results;
  }

  async getQueryCount(): Promise<number> {
    const keys = await this.redis.keys(`${this.PREFIX}*`);
    return keys.length;
  }
}
