/**
 * Auto-generated Soroban contract type bindings.
 * DO NOT EDIT MANUALLY — regenerate with: npm run generate:contract-types
 *
 * Contract ABI version: 1.0.0
 * Methods: anchor_record, grant_access, revoke_access, verify_access
 */

import * as StellarSdk from '@stellar/stellar-sdk';

// ── Argument types ────────────────────────────────────────────────────────────

export interface AnchorRecordArgs {
  /** Unique patient identifier */
  patientId: string;
  /** IPFS Content Identifier (CIDv0 / CIDv1) */
  cid: string;
}

export interface GrantAccessArgs {
  /** Owner patient's identifier */
  patientId: string;
  /** Identifier of the party being granted access */
  granteeId: string;
  /** Specific record identifier */
  recordId: string;
  /** Unix timestamp (ms) at which the grant expires */
  expiresAtMs: bigint;
}

export interface RevokeAccessArgs {
  /** Owner patient's identifier */
  patientId: string;
  /** Identifier of the party whose access is revoked */
  granteeId: string;
  /** Specific record identifier */
  recordId: string;
}

export interface VerifyAccessArgs {
  /** Identifier of the access requester */
  requesterId: string;
  /** Specific record identifier */
  recordId: string;
}

// ── Return types ──────────────────────────────────────────────────────────────

export interface AnchorRecordResult {
  /** Stellar transaction hash */
  txHash: string;
  /** Ledger sequence number */
  ledger: number;
  /** Unix timestamp (ms) when confirmed */
  confirmedAt: number;
}

export interface GrantAccessResult {
  txHash: string;
  ledger: number;
  confirmedAt: number;
}

export interface RevokeAccessResult {
  txHash: string;
  ledger: number;
  confirmedAt: number;
}

export interface VerifyAccessResult {
  /** Whether the requester currently has valid access */
  hasAccess: boolean;
  /** ISO-8601 expiry string, or null if no grant found */
  expiresAt: string | null;
}

// ── On-chain struct shapes (as returned by scValToNative) ─────────────────────

export interface OnChainVerifyAccessResponse {
  has_access: boolean;
  expires_at: bigint | number;
}

// ── ScVal encoder helpers ─────────────────────────────────────────────────────

/**
 * Encode AnchorRecordArgs into an ordered ScVal array for contract invocation.
 */
export function encodeAnchorRecord(args: AnchorRecordArgs): StellarSdk.xdr.ScVal[] {
  return [
    StellarSdk.nativeToScVal(args.patientId, { type: 'string' }),
    StellarSdk.nativeToScVal(args.cid, { type: 'string' }),
  ];
}

/**
 * Encode GrantAccessArgs into an ordered ScVal array.
 */
export function encodeGrantAccess(args: GrantAccessArgs): StellarSdk.xdr.ScVal[] {
  return [
    StellarSdk.nativeToScVal(args.patientId, { type: 'string' }),
    StellarSdk.nativeToScVal(args.granteeId, { type: 'string' }),
    StellarSdk.nativeToScVal(args.recordId, { type: 'string' }),
    StellarSdk.nativeToScVal(args.expiresAtMs, { type: 'u64' }),
  ];
}

/**
 * Encode RevokeAccessArgs into an ordered ScVal array.
 */
export function encodeRevokeAccess(args: RevokeAccessArgs): StellarSdk.xdr.ScVal[] {
  return [
    StellarSdk.nativeToScVal(args.patientId, { type: 'string' }),
    StellarSdk.nativeToScVal(args.granteeId, { type: 'string' }),
    StellarSdk.nativeToScVal(args.recordId, { type: 'string' }),
  ];
}

/**
 * Encode VerifyAccessArgs into an ordered ScVal array.
 */
export function encodeVerifyAccess(args: VerifyAccessArgs): StellarSdk.xdr.ScVal[] {
  return [
    StellarSdk.nativeToScVal(args.requesterId, { type: 'string' }),
    StellarSdk.nativeToScVal(args.recordId, { type: 'string' }),
  ];
}

/**
 * Decode the raw ScVal returned by verify_access into a typed result.
 */
export function decodeVerifyAccessResult(retval: StellarSdk.xdr.ScVal): VerifyAccessResult {
  const native = StellarSdk.scValToNative(retval) as Partial<OnChainVerifyAccessResponse>;
  const hasAccess = Boolean(native?.has_access);
  const expiresAtRaw = native?.expires_at;
  const expiresAt =
    expiresAtRaw != null ? new Date(Number(expiresAtRaw)).toISOString() : null;
  return { hasAccess, expiresAt };
}

// ── Contract method name constants ────────────────────────────────────────────

export const CONTRACT_METHODS = {
  ANCHOR_RECORD: 'anchor_record',
  GRANT_ACCESS: 'grant_access',
  REVOKE_ACCESS: 'revoke_access',
  VERIFY_ACCESS: 'verify_access',
} as const;

export type ContractMethod = (typeof CONTRACT_METHODS)[keyof typeof CONTRACT_METHODS];

// ── ABI manifest (used by CI drift check) ────────────────────────────────────

export const CONTRACT_ABI = {
  version: '1.0.0',
  methods: [
    {
      name: CONTRACT_METHODS.ANCHOR_RECORD,
      args: [
        { name: 'patient_id', type: 'string' },
        { name: 'cid', type: 'string' },
      ],
      returns: 'void',
    },
    {
      name: CONTRACT_METHODS.GRANT_ACCESS,
      args: [
        { name: 'patient_id', type: 'string' },
        { name: 'grantee_id', type: 'string' },
        { name: 'record_id', type: 'string' },
        { name: 'expires_at', type: 'u64' },
      ],
      returns: 'void',
    },
    {
      name: CONTRACT_METHODS.REVOKE_ACCESS,
      args: [
        { name: 'patient_id', type: 'string' },
        { name: 'grantee_id', type: 'string' },
        { name: 'record_id', type: 'string' },
      ],
      returns: 'void',
    },
    {
      name: CONTRACT_METHODS.VERIFY_ACCESS,
      args: [
        { name: 'requester_id', type: 'string' },
        { name: 'record_id', type: 'string' },
      ],
      returns: '{ has_access: bool, expires_at: u64 }',
    },
  ],
} as const;
