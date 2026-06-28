/**
 * Multi-signature transaction support for high-value Stellar payments.
 *
 * When a payment amount exceeds a configurable threshold per tenant,
 * it enters a pending_signatures state. Authorised signers must approve
 * (quorum) before the transaction is submitted to Stellar.
 */

export enum MultiSigTransactionStatus {
  PENDING_SIGNATURES = 'pending_signatures',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  SUBMITTED = 'submitted',
}

export enum SignatureStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface SignerEntry {
  signerId: string;
  status: SignatureStatus;
  signedAt?: string; // ISO-8601
  reason?: string;   // rejection reason
}

export interface MultiSigConfig {
  /** Amount threshold in XLM (or asset units) above which multi-sig is required */
  thresholdAmount: string;
  /** Number of signers required for quorum (e.g. 2 for 2-of-3) */
  quorumSize: number;
  /** Total authorised signer public keys */
  signers: string[];
  /** Time-to-live in minutes for pending transactions */
  ttlMinutes: number;
}

export interface CreateMultiSigPaymentDto {
  tenantId: string;
  destination: string;  // Stellar public key
  amount: string;       // Amount as string to avoid precision issues
  asset?: string;       // Default 'XLM'
  memo?: string;
}

export interface ApproveRejectDto {
  signerId: string;
  reason?: string;
}

export interface MultiSigTransactionResponse {
  id: string;
  tenantId: string;
  destination: string;
  amount: string;
  asset: string;
  status: MultiSigTransactionStatus;
  threshold: number;
  totalSigners: number;
  signatures: SignerEntry[];
  stellarTxHash?: string;
  expiresAt: string;
  createdAt: string;
  memo?: string;
}
