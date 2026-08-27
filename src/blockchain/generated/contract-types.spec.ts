import * as StellarSdk from '@stellar/stellar-sdk';
import { encodeGrantAccess, decodeVerifyAccessResult } from './contract-types';

// ── Mock @stellar/stellar-sdk ─────────────────────────────────────────────
//
// nativeToScVal just wraps its value so encode tests can inspect exactly
// what was handed to it; scValToNative is stubbed per-test so decode tests
// can control what the "on-chain" struct looks like.

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    nativeToScVal: jest.fn((val: unknown) => ({ value: val })),
    scValToNative: jest.fn(),
  };
});

/**
 * Regression tests for #967: grant_access/verify_access's expires_at is
 * Soroban seconds-since-epoch on-chain, but every TS-facing value in this
 * codebase is milliseconds (Date.now()-style). encodeGrantAccess and
 * decodeVerifyAccessResult are the only two places that boundary is
 * crossed, so they're the only two places this can regress.
 */
describe('generated contract-types (#967 ms-vs-seconds boundary)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('encodeGrantAccess', () => {
    it('converts expiresAt from milliseconds to on-chain seconds', () => {
      const expiresAt = BigInt(Date.now() + 7 * 24 * 60 * 60 * 1000); // ms, +7 days

      const scVals = encodeGrantAccess({
        patientId: 'patient-1',
        granteeId: 'grantee-1',
        recordId: 'record-1',
        expiresAt,
      });

      const encodedExpiresAt = scVals[3] as unknown as { value: bigint };
      expect(encodedExpiresAt.value).toBe(expiresAt / 1000n);
    });
  });

  describe('decodeVerifyAccessResult', () => {
    it('converts on-chain seconds to a correct ISO-8601 expiry', () => {
      const expiresAtSecs = BigInt(Math.floor(Date.now() / 1000) + 3600); // +1h, seconds

      (StellarSdk.scValToNative as jest.Mock).mockReturnValueOnce({
        has_access: true,
        expires_at: expiresAtSecs,
      });

      const result = decodeVerifyAccessResult({} as StellarSdk.xdr.ScVal);

      expect(result.hasAccess).toBe(true);
      expect(result.expiresAt).toBe(new Date(Number(expiresAtSecs) * 1000).toISOString());
    });

    it('returns null expiresAt when the on-chain value is absent', () => {
      (StellarSdk.scValToNative as jest.Mock).mockReturnValueOnce({ has_access: false });

      const result = decodeVerifyAccessResult({} as StellarSdk.xdr.ScVal);

      expect(result.hasAccess).toBe(false);
      expect(result.expiresAt).toBeNull();
    });
  });
});
