import { Logger } from '@nestjs/common';
import { RedisLockService } from '../../redis/redis-lock.service';

/**
 * Options for {@link WithDistributedLock}.
 */
export interface WithDistributedLockOptions {
  /**
   * Lock key. Defaults to the decorated method name. When multiple replicas
   * run the same `@Cron`, they all compute the same key and only one wins.
   */
  key?: string;
  /** Lock TTL in milliseconds. Defaults to 5 minutes. */
  ttlMs?: number;
  /**
   * Optional function to derive the lock key from the method arguments.
   * Useful for jobs that fan out per-tenant/per-entity.
   */
  keyFn?: (...args: unknown[]) => string;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * Wraps a scheduled method so that only one replica executes it per tick.
 *
 * The lock is acquired through {@link RedisLockService}; if the lock cannot be
 * acquired (another replica holds it) or acquisition throws, the invocation is
 * skipped and logged instead of crashing the scheduler.
 *
 * Usage:
 * ```ts
 * @Cron(CronExpression.EVERY_HOUR)
 * @WithDistributedLock({ key: 'subscription-renewal' })
 * async handleRenewals() { ... }
 * ```
 */
export function WithDistributedLock(
  options: WithDistributedLockOptions = {},
): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    const logger = new Logger(`${target.constructor.name}.${String(propertyKey)}`);
    const baseKey = options.key ?? String(propertyKey);
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

    descriptor.value = async function (
      this: { redisLockService?: RedisLockService },
      ...args: unknown[]
    ): Promise<unknown> {
      const lockService = this?.redisLockService;
      if (!lockService) {
        logger.warn(
          `RedisLockService not available on ${target.constructor.name}; running ${baseKey} without a distributed lock`,
        );
        return original.apply(this, args);
      }

      const lockKey = options.keyFn
        ? `cron-lock:${baseKey}:${options.keyFn(...args)}`
        : `cron-lock:${baseKey}`;

      let acquired = false;
      try {
        acquired = await lockService.acquireLock(lockKey, ttlMs);
      } catch (error) {
        logger.error(
          `Failed to acquire distributed lock for ${baseKey}; skipping this tick`,
          error instanceof Error ? error.stack : String(error),
        );
        return undefined;
      }

      if (!acquired) {
        logger.debug(
          `Distributed lock for ${baseKey} held by another replica; skipping this tick`,
        );
        return undefined;
      }

      try {
        return await original.apply(this, args);
      } finally {
        try {
          await lockService.releaseLock(lockKey);
        } catch (error) {
          logger.warn(
            `Failed to release distributed lock for ${baseKey}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    };

    return descriptor;
  };
}
