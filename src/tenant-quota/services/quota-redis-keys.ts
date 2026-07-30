/**
 * Centralised factory for Redis key patterns used by the quota system.
 *
 * Using consistent prefixes makes it easy to:
 *  - inspect quota counters with `redis-cli --scan --pattern 'quota:*'`
 *  - set targeted TTLs
 *  - avoid collisions with other Redis consumers
 */
export const QuotaRedisKeys = {
  /** Monthly record-creation counter – resets at UTC month boundary. */
  monthlyRecords: (tenantId: string): string =>
    `quota:${tenantId}:records:${monthKey()}`,

  /** Hourly API-call counter – resets at the top of each UTC hour. */
  hourlyApiCalls: (tenantId: string): string =>
    `quota:${tenantId}:api_calls:${hourKey()}`,

  /**
   * Active bulk-operation gauge.
   * Incremented at job start, decremented (or expired) at job end.
   * TTL is set conservatively (e.g. 6 h) to self-heal on crashed workers.
   */
  bulkOperations: (tenantId: string): string =>
    `quota:${tenantId}:bulk_ops`,

  /** Storage usage in bytes – updated on every file upload / deletion. */
  storageBytes: (tenantId: string): string =>
    `quota:${tenantId}:storage_bytes`,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns YYYY-MM for the current UTC month, e.g. "2025-05". */
export function monthKey(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Returns YYYY-MM-DD-HH for the current UTC hour, e.g. "2025-05-12-14". */
export function hourKey(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}`;
}

/** Seconds until midnight UTC on the first day of next month. */
export function secondsUntilMonthEnd(): number {
  const now = new Date();
  const nextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  return Math.ceil((nextMonth.getTime() - now.getTime()) / 1000);
}

/** Seconds until the next top-of-hour boundary UTC. */
export function secondsUntilNextHour(): number {
  const now = new Date();
  const nextHour = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours() + 1,
      0,
      0,
      0,
    ),
  );
  return Math.ceil((nextHour.getTime() - now.getTime()) / 1000);
}