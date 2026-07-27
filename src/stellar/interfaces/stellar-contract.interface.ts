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
  operation: 'anchorRecord' | 'grantAccess' | 'revokeAccess' | 'verifyAccess' | 'submitTransaction' | 'getAccount' | 'invokeContract' | 'getContractEvents';
  attempt: number;
  durationMs: number;
  success: boolean;
  txHash?: string;
  error?: string;
}

// ── Issue #234: StellarService abstraction typed responses ────────────────

/** Typed result of submitTransaction — no raw SDK objects exposed. */
export interface SubmitTransactionResult {
  txHash: string;
  ledger: number;
  confirmedAt: number;
  status: 'SUCCESS' | 'FAILED';
}

/** Typed account info returned by getAccount. */
export interface StellarAccountInfo {
  accountId: string;
  sequence: string;
  balances: Array<{
    asset: string;
    balance: string;
  }>;
}

/** Typed result of invokeContract — decoded native value, no raw ScVal. */
export interface InvokeContractResult {
  txHash: string;
  ledger: number;
  confirmedAt: number;
  /** Decoded return value from the contract call (native JS type). */
  returnValue: unknown;
}

/** A single decoded contract event. */
export interface ContractEvent {
  id: string;
  ledger: number;
  contractId: string;
  /** Decoded event topics (native JS types). */
  topics: unknown[];
  /** Decoded event value (native JS type). */
  value: unknown;
}

/** Active Stellar network. */
export type StellarNetwork = 'testnet' | 'mainnet';
