import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionPriority, TransactionStatus } from './stellar-transaction-queue.service';
import { TransactionContext } from './stellar-transaction-retry.service';

export interface PersistedQueueEntry {
  id: string;
  xdr: string;
  context: TransactionContext;
  sourcePublicKey: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string;
  createdAt: string;
  lastAttemptAt?: string;
  lastError?: string;
  priority: TransactionPriority;
  status: TransactionStatus;
}

const INDEX_KEY = 'stellar:retry:index';
const entryKey = (id: string) => `stellar:retry:${id}`;

@Injectable()
export class StellarRetryStoreService {
  private readonly logger = new Logger(StellarRetryStoreService.name);
  private redis: any;

  constructor(private readonly configService: ConfigService) {}

  private async getClient(): Promise<any> {
    if (!this.redis) {
      const Redis = require('ioredis');
      this.redis = new Redis({
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get<string>('REDIS_PASSWORD'),
        db: this.configService.get<number>('REDIS_DB', 0),
        lazyConnect: true,
      });
      await this.redis.connect().catch((err: Error) => {
        this.logger.warn(`Redis connect warning: ${err.message}`);
      });
    }
    return this.redis;
  }

  async save(entry: PersistedQueueEntry): Promise<void> {
    try {
      const client = await this.getClient();
      await client.set(entryKey(entry.id), JSON.stringify(entry));
      await client.sadd(INDEX_KEY, entry.id);
    } catch (err: any) {
      this.logger.error(`Failed to persist queue entry ${entry.id}: ${err.message}`);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const client = await this.getClient();
      await client.del(entryKey(id));
      await client.srem(INDEX_KEY, id);
    } catch (err: any) {
      this.logger.error(`Failed to remove queue entry ${id}: ${err.message}`);
    }
  }

  async loadAll(): Promise<PersistedQueueEntry[]> {
    try {
      const client = await this.getClient();
      const ids: string[] = await client.smembers(INDEX_KEY);
      if (!ids.length) return [];

      const pipeline = client.pipeline();
      for (const id of ids) pipeline.get(entryKey(id));
      const results: [Error | null, string | null][] = await pipeline.exec();

      const entries: PersistedQueueEntry[] = [];
      for (let i = 0; i < results.length; i++) {
        const [err, raw] = results[i];
        if (err || !raw) {
          // Stale index entry — clean up
          await client.srem(INDEX_KEY, ids[i]);
          continue;
        }
        try {
          entries.push(JSON.parse(raw) as PersistedQueueEntry);
        } catch {
          await client.srem(INDEX_KEY, ids[i]);
        }
      }
      return entries;
    } catch (err: any) {
      this.logger.error(`Failed to load queue entries: ${err.message}`);
      return [];
    }
  }
}
