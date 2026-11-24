import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Distributed lock backed by Redis (SET NX PX + token-checked release).
 *
 * Used to guarantee that scheduled jobs (`@Cron`) execute on a single
 * replica when the API/worker runs with more than one instance.
 */
@Injectable()
export class RedisLockService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisLockService.name);
  private readonly client: Redis;
  private readonly defaultTtlMs: number;

  constructor(private readonly configService: ConfigService) {
    const url =
      this.configService.get<string>('REDIS_URL') ??
      `redis://${this.configService.get<string>('REDIS_HOST', 'localhost')}:${this.configService.get<string>('REDIS_PORT', '6379')}`;

    this.client = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
    });
    this.client.on('error', (err) =>
      this.logger.error(`Redis lock connection error: ${err.message}`),
    );

    this.defaultTtlMs = Number(
      this.configService.get<string>('REDIS_LOCK_TTL_MS', '300000'),
    );
  }

  /**
   * Try to acquire a lock. Returns the lock token when acquired, or `null`
   * when another replica already holds it.
   */
  async acquire(
    key: string,
    ttlMs: number = this.defaultTtlMs,
  ): Promise<string | null> {
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const result = await this.client.set(key, token, 'PX', ttlMs, 'NX');
      return result === 'OK' ? token : null;
    } catch (err) {
      this.logger.error(
        `Failed to acquire lock "${key}": ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Release a lock only if we still own it (token match). Safe to call when
   * the lock already expired or was never acquired.
   */
  async release(key: string, token: string | null): Promise<void> {
    if (!token) {
      return;
    }
    try {
      await this.client.eval(
        `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
        1,
        key,
        token,
      );
    } catch (err) {
      this.logger.error(
        `Failed to release lock "${key}": ${(err as Error).message}`,
      );
    }
  }

  /**
   * Run `fn` while holding the lock. When the lock cannot be acquired the
   * callback is skipped (returns `undefined`) instead of throwing, so a
   * duplicate tick on another replica is a no-op rather than a crash.
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = this.defaultTtlMs,
  ): Promise<T | undefined> {
    const token = await this.acquire(key, ttlMs);
    if (!token) {
      this.logger.debug(`Lock "${key}" held elsewhere, skipping execution`);
      return undefined;
    }
    try {
      return await fn();
    } finally {
      await this.release(key, token);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
