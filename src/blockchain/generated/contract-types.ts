/**
 * Auto-generated Soroban contract type bindings.
 * DO NOT EDIT MANUALLY — regenerate with: npm run generate:contract-types
 *
 * Contract ABI version: 1.0.0
 * Methods: anchor_record, grant_access, revoke_access, verify_access
 */

import * as StellarSdk from '@stellar/stellar-sdk';

export interface AnchorRecordArgs {
  patientId: string;
  cid: string;
}

export interface GrantAccessArgs {
  patientId: string;
  granteeId: string;
  recordId: string;
  /** Milliseconds since epoch (Date.now()-style). encodeGrantAccess converts this to on-chain seconds. */
  expiresAt: bigint;
}

export interface RevokeAccessArgs {
  patientId: string;
  granteeId: string;
  recordId: string;
}

export interface VerifyAccessArgs {
  requesterId: string;
  recordId: string;
}

export interface AnchorRecordResult {
  txHash: string;
  ledger: number;
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
  hasAccess: boolean;
  /** ISO 8601, or null. Converted from on-chain seconds by decodeVerifyAccessResult. */
  expiresAt: string | null;
}

export interface OnChainVerifyAccessResponse {
  has_access: boolean;
  expires_at: bigint | number;
}

export function decodeVerifyAccessResult(retval: StellarSdk.xdr.ScVal): VerifyAccessResult {
  const native = StellarSdk.scValToNative(retval) as Partial<OnChainVerifyAccessResponse>;
  return {
    hasAccess: Boolean(native?.has_access),
    expiresAt: native?.expires_at != null ? new Date(Number(native.expires_at) * 1000).toISOString() : null,
  };
}

export function encodeAnchorRecord(args: AnchorRecordArgs): StellarSdk.xdr.ScVal[] {
  return [
    StellarSdk.nativeToScVal(args.patientId, { type: 'string' }),
    StellarSdk.nativeToScVal(args.cid, { type: 'string' }),
  ];
}

export function encodeGrantAccess(args: GrantAccessArgs): StellarSdk.xdr.ScVal[] {
  return [
    StellarSdk.nativeToScVal(args.patientId, { type: 'string' }),
    StellarSdk.nativeToScVal(args.granteeId, { type: 'string' }),
    StellarSdk.nativeToScVal(args.recordId, { type: 'string' }),
    StellarSdk.nativeToScVal(args.expiresAt / 1000n, { type: 'u64' }),
  ];
}

export function encodeRevokeAccess(args: RevokeAccessArgs): StellarSdk.xdr.ScVal[] {
  return [
    StellarSdk.nativeToScVal(args.patientId, { type: 'string' }),
    StellarSdk.nativeToScVal(args.granteeId, { type: 'string' }),
    StellarSdk.nativeToScVal(args.recordId, { type: 'string' }),
  ];
}

export function encodeVerifyAccess(args: VerifyAccessArgs): StellarSdk.xdr.ScVal[] {
  return [
    StellarSdk.nativeToScVal(args.requesterId, { type: 'string' }),
    StellarSdk.nativeToScVal(args.recordId, { type: 'string' }),
  ];
}

export const CONTRACT_METHODS = {
  ANCHOR_RECORD: 'anchor_record',
  GRANT_ACCESS: 'grant_access',
  REVOKE_ACCESS: 'revoke_access',
  VERIFY_ACCESS: 'verify_access',
} as const;

export type ContractMethod = (typeof CONTRACT_METHODS)[keyof typeof CONTRACT_METHODS];

export const CONTRACT_ABI = {
  "version": "1.0.0",
  "methods": [
    {
      "name": "anchor_record",
      "args": [
        {
          "name": "patient_id",
          "type": "string"
        },
        {
          "name": "cid",
          "type": "string"
        }
      ],
      "returns": "void"
    },
    {
      "name": "grant_access",
      "args": [
        {
          "name": "patient_id",
          "type": "string"
        },
        {
          "name": "grantee_id",
          "type": "string"
        },
        {
          "name": "record_id",
          "type": "string"
        },
        {
          "name": "expires_at",
          "type": "u64"
        }
      ],
      "returns": "void"
    },
    {
      "name": "revoke_access",
      "args": [
        {
          "name": "patient_id",
          "type": "string"
        },
        {
          "name": "grantee_id",
          "type": "string"
        },
        {
          "name": "record_id",
          "type": "string"
        }
      ],
      "returns": "void"
    },
    {
      "name": "verify_access",
      "args": [
        {
          "name": "requester_id",
          "type": "string"
        },
        {
          "name": "record_id",
          "type": "string"
        }
      ],
      "returns": {
        "has_access": "bool",
        "expires_at": "u64"
      }
    }
  ]
} as const;
