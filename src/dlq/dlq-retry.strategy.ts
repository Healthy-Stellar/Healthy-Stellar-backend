/** BullMQ backoff type identifier for the DLQ exponential strategy. */
export const DLQ_BACKOFF_TYPE = 'dlq-exponential' as const;

/**
 * Total attempts per job (1 initial + 3 retries).
 * Delays between retries: 1 s → 4 s → 16 s.
 */
export const DLQ_MAX_ATTEMPTS = 4;

/** Base delay for the first retry (milliseconds). */
export const DLQ_BASE_DELAY_MS = 1_000;

/**
 * Custom BullMQ backoff strategy.
 *
 * Uses a 4× multiplier per retry so delays follow 1 s → 4 s → 16 s:
 *   attemptsMade=1 → 1 000 ms
 *   attemptsMade=2 → 4 000 ms
 *   attemptsMade=3 → 16 000 ms
 *
 * Register this function in every Worker's `settings.backoffStrategies`
 * under the key `DLQ_BACKOFF_TYPE`.
 */
export function dlqBackoffStrategy(attemptsMade: number): number {
  return DLQ_BASE_DELAY_MS * Math.pow(4, attemptsMade - 1);
}

/**
 * Shared Worker settings that register the `dlq-exponential` backoff strategy.
 *
 * Import and spread this into any @Processor's options object so that
 * custom backoff strategies are consistently available across all workers:
 *
 *   @Processor(QUEUE_NAMES.MY_QUEUE, DLQ_WORKER_SETTINGS)
 */
export const DLQ_WORKER_SETTINGS = {
  settings: { backoffStrategies: { [DLQ_BACKOFF_TYPE]: dlqBackoffStrategy } },
};
