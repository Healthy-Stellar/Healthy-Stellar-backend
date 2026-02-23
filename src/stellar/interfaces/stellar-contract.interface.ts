/**
 * Stellar Contract Interfaces
 *
 * Shared types for all Soroban contract interactions performed
 * by StellarService.
 */

/** Result returned by any write-operation (anchor / grant / revoke). */
export interface StellarTxResult {
  /** Stellar transaction hash (hex string). */
  txHash: string;
  /** Ledger sequence number the transaction was included in. */
  ledger: number;
  /** Unix timestamp (ms) when the transaction was confirmed. */
  confirmedAt: number;
}

/** Result returned by verifyAccess. */
export interface StellarVerifyResult {
  /** Whether the requester is currently authorised to access the record. */
  hasAccess: boolean;
  /** ISO-8601 string of when the grant expires, or null if no grant found. */
  expiresAt: string | null;
}

/** Structured payload emitted to the logger on every contract call. */
export interface StellarOperationLog {
  operation: 'anchorRecord' | 'grantAccess' | 'revokeAccess' | 'verifyAccess';
  attempt: number;
  durationMs: number;
  success: boolean;
  txHash?: string;
  error?: string;
}
