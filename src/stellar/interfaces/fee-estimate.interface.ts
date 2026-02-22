/**
 * Stellar Fee Estimate Response
 */
export interface FeeEstimateResponse {
  baseFee: string;
  recommended: string;
  networkCongestion: 'low' | 'medium' | 'high';
}

/**
 * Horizon Fee Stats Response
 * Based on Stellar Horizon API
 */
export interface HorizonFeeStatsResponse {
  last_ledger: string;
  last_ledger_base_fee: string;
  ledger_capacity_usage: string;
  fee_charged: {
    max: string;
    min: string;
    mode: string;
    p10: string;
    p20: string;
    p30: string;
    p40: string;
    p50: string;
    p60: string;
    p70: string;
    p80: string;
    p90: string;
    p95: string;
    p99: string;
  };
  max_fee: {
    max: string;
    min: string;
    mode: string;
    p10: string;
    p20: string;
    p30: string;
    p40: string;
    p50: string;
    p60: string;
    p70: string;
    p80: string;
    p90: string;
    p95: string;
    p99: string;
  };
}

/**
 * Supported Stellar operations for fee estimation
 */
export const StellarOperation = {
  ANCHOR_RECORD: 'anchorRecord',
  GRANT_ACCESS: 'grantAccess',
  REVOKE_ACCESS: 'revokeAccess',
} as const;

export type StellarOperation = typeof StellarOperation[keyof typeof StellarOperation];
