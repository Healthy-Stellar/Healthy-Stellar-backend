export interface QuotaTierLimits {
  /** Maximum records that can be created per calendar month */
  recordsPerMonth: number;
  /** Maximum storage in bytes (e.g. 5 * 1024^3 for 5 GB) */
  storageBytes: number;
  /** Maximum API write calls per hour */
  apiCallsPerHour: number;
  /** Maximum concurrent bulk-operation jobs (exports / imports) */
  bulkOperationsConcurrent: number;
}

export type TenantTier = 'free' | 'starter' | 'professional' | 'enterprise';

export const QUOTA_TIER_DEFAULTS: Record<TenantTier, QuotaTierLimits> = {
  free: {
    recordsPerMonth: 500,
    storageBytes: 512 * 1024 * 1024,        // 512 MB
    apiCallsPerHour: 100,
    bulkOperationsConcurrent: 1,
  },
  starter: {
    recordsPerMonth: 5_000,
    storageBytes: 5 * 1024 * 1024 * 1024,   // 5 GB
    apiCallsPerHour: 1_000,
    bulkOperationsConcurrent: 2,
  },
  professional: {
    recordsPerMonth: 50_000,
    storageBytes: 50 * 1024 * 1024 * 1024,  // 50 GB
    apiCallsPerHour: 10_000,
    bulkOperationsConcurrent: 5,
  },
  enterprise: {
    recordsPerMonth: Number.MAX_SAFE_INTEGER,
    storageBytes: Number.MAX_SAFE_INTEGER,
    apiCallsPerHour: Number.MAX_SAFE_INTEGER,
    bulkOperationsConcurrent: Number.MAX_SAFE_INTEGER,
  },
};