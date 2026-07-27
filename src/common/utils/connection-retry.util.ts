import { Logger } from '@nestjs/common';

export const MAX_RETRIES = 10;
export const RETRY_DELAY_MS = 3000;

const logger = new Logger('ConnectionRetryUtil');

/**
 * Returns a TypeORM-compatible `toRetry` callback.
 * Logs each attempt, exits with code 1 after MAX_RETRIES exhausted.
 */
export function createTypeOrmRetryCallback(
  maxRetries = MAX_RETRIES,
): (err: Error) => boolean {
  let attempt = 0;
  return (err: Error): boolean => {
    attempt++;
    logger.error(
      `[TypeORM] Database connection attempt ${attempt} failed. Error: ${err.message}`,
    );
    if (attempt >= maxRetries) {
      logger.error(
        `[TypeORM] Max connection retries (${maxRetries}) exhausted. Exiting...`,
      );
      process.exit(1);
    }
    return true;
  };
}

const REDIS_BASE_DELAY_MS = 500;
const REDIS_MAX_DELAY_MS = 30_000;

/**
 * Returns an ioredis-compatible `retryStrategy` callback with exponential backoff.
 * Exits with code 1 after MAX_RETRIES exhausted.
 */
export function createRedisRetryStrategy(
  maxRetries = MAX_RETRIES,
): (times: number) => number | null {
  return (times: number): number | null => {
    logger.error(`[Redis] Connection attempt ${times} failed.`);
    if (times >= maxRetries) {
      logger.error(
        `[Redis] Max connection retries (${maxRetries}) exhausted. Exiting...`,
      );
      process.exit(1);
    }
    const delay = Math.min(REDIS_BASE_DELAY_MS * Math.pow(2, times - 1), REDIS_MAX_DELAY_MS);
    return delay;
  };
}
