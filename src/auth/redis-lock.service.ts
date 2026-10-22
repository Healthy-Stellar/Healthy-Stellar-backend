import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export interface LockHandle {
  /** Release the lock early (no-op if already expired). */
  release(): Promise<void>;
}

/**
 * Thin wrapper around Redis SET NX for distributed mutual exclusion.
 *
 * Usage:
 *   const lock = await redisLock.acquire('my:lock', 30_000);
 *   if (!lock) return; // another process holds it
 *   try { … } finally { await lock.release(); }
 */
@Injectable()
export class RedisLockService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisLockService.name);

  // Lua script: only DELETE the key if its value matches our token.
  // This prevents a slow process from releasing a lock it no longer owns.
  private static readonly RELEASE_SCRIPT = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Try to acquire a distributed lock.
   *
   * @param key       Redis key for the lock
   * @param ttlMs     Lock TTL in milliseconds (safety net if release is skipped)
   * @returns         A LockHandle to release the lock, or null if not acquired
   */
  async acquire(key: string, ttlMs: number): Promise<LockHandle | null> {
    const token = `${process.pid}:${Date.now()}:${Math.random()}`;

    // SET key token NX PX ttlMs
    const result = await this.redis.set(key, token, 'NX', 'PX', ttlMs);

    if (result !== 'OK') {
      this.logger.debug(`Lock [${key}] already held — skipping.`);
      return null;
    }

    this.logger.debug(`Lock [${key}] acquired (ttl=${ttlMs}ms).`);

    return {
      release: async () => {
        try {
          await this.redis.eval(
            RedisLockService.RELEASE_SCRIPT,
            1,
            key,
            token,
          );
          this.logger.debug(`Lock [${key}] released.`);
        } catch (err) {
          this.logger.warn(`Failed to release lock [${key}]: ${err}`);
        }
      },
    };
  }

  async onModuleDestroy(): Promise<void> {
    // Nothing to teardown — Redis connection lifecycle is managed by the module.
  }
}