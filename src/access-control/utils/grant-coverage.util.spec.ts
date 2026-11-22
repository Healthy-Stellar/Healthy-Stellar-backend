import { AccessGrant, GrantStatus } from '../entities/access-grant.entity';
import {
  WILDCARD_RECORD_ID,
  grantCoversRecord,
  grantListsRecord,
  isGrantActive,
} from './grant-coverage.util';

const PATIENT = 'patient-1';
const RECORD = 'record-1';
const NOW = new Date('2026-01-01T00:00:00Z');

const grant = (overrides: Partial<AccessGrant> = {}) =>
  ({
    patientId: PATIENT,
    recordIds: [RECORD],
    status: GrantStatus.ACTIVE,
    expiresAt: null,
    revokedAt: null,
    ...overrides,
  }) as AccessGrant;

describe('grant-coverage.util', () => {
  describe('grantCoversRecord', () => {
    it('covers a record named explicitly', () => {
      expect(grantCoversRecord(grant(), RECORD, PATIENT, NOW)).toBe(true);
    });

    it('covers any record of the patient with the wildcard', () => {
      const wildcard = grant({ recordIds: [WILDCARD_RECORD_ID] });
      expect(grantCoversRecord(wildcard, RECORD, PATIENT, NOW)).toBe(true);
      expect(grantCoversRecord(wildcard, 'another-record', PATIENT, NOW)).toBe(true);
    });

    it('never covers another patient\'s record, even with the wildcard', () => {
      expect(grantCoversRecord(grant({ recordIds: ['*'] }), RECORD, 'patient-2', NOW)).toBe(false);
      expect(grantCoversRecord(grant(), RECORD, 'patient-2', NOW)).toBe(false);
    });

    it('does not cover an unlisted record', () => {
      expect(grantCoversRecord(grant({ recordIds: ['other'] }), RECORD, PATIENT, NOW)).toBe(false);
    });

    it('does not cover anything once expired', () => {
      const expired = grant({ recordIds: ['*'], expiresAt: new Date(NOW.getTime() - 1) });
      expect(grantCoversRecord(expired, RECORD, PATIENT, NOW)).toBe(false);
      // Expiry is exclusive: a grant expiring exactly now is no longer valid.
      expect(grantCoversRecord(grant({ expiresAt: NOW }), RECORD, PATIENT, NOW)).toBe(false);
    });

    it('covers until the expiry time', () => {
      const valid = grant({ expiresAt: new Date(NOW.getTime() + 60_000) });
      expect(grantCoversRecord(valid, RECORD, PATIENT, NOW)).toBe(true);
    });

    it('does not cover anything once revoked', () => {
      expect(grantCoversRecord(grant({ status: GrantStatus.REVOKED }), RECORD, PATIENT, NOW)).toBe(false);
      expect(grantCoversRecord(grant({ revokedAt: NOW }), RECORD, PATIENT, NOW)).toBe(false);
    });

    it.each([GrantStatus.EXPIRED, GrantStatus.EXPIRING])('does not cover anything when status is %s', (status) => {
      expect(grantCoversRecord(grant({ status }), RECORD, PATIENT, NOW)).toBe(false);
    });

    it('rejects missing grants and missing patient ids', () => {
      expect(grantCoversRecord(null, RECORD, PATIENT, NOW)).toBe(false);
      expect(grantCoversRecord(grant(), RECORD, '', NOW)).toBe(false);
      expect(grantCoversRecord(grant(), RECORD, undefined, NOW)).toBe(false);
    });
  });

  it('isGrantActive ignores record ids', () => {
    expect(isGrantActive(grant({ recordIds: [] }), NOW)).toBe(true);
  });

  it('grantListsRecord handles a missing recordIds array', () => {
    expect(grantListsRecord({ recordIds: undefined } as AccessGrant, RECORD)).toBe(false);
  });
});
