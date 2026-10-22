/**
 * Audit Chain Interfaces
 *
 * Types for the tamper-proof hash chain anchored to the Stellar ledger.
 */

export interface ChainEntry {
  id: string;
  entryHash: string;
  previousHash: string | null;
}

export interface ChainSegment {
  entries: ChainEntry[];
  valid: boolean;
  stellarAnchorTxId?: string;
  error?: string;
}

export interface VerifyChainResult {
  valid: boolean;
  fromId: string;
  toId: string;
  totalEntries: number;
  stellarTxId?: string;
  error?: string;
}

export interface AnchorRecord {
  /** Root hash of the chain segment that was anchored */
  rootHash: string;
  /** Stellar transaction hash of the ManageData operation */
  txHash: string;
  /** Timestamp when the anchor was created */
  anchoredAt: Date;
  /** Number of entries covered by this anchor */
  entryCount: number;
}
