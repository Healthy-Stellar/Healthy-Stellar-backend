import { AccessGrant, GrantStatus } from '../entities/access-grant.entity';

/**
 * Record-id wildcard stored in `AccessGrant.recordIds`.
 *
 * Grants created by an approved access request or by emergency / break-glass
 * access use `['*']`, meaning "every record belonging to the grant's patient".
 */
export const WILDCARD_RECORD_ID = '*';

type GrantLike = Pick<AccessGrant, 'patientId' | 'recordIds' | 'status' | 'expiresAt' | 'revokedAt'>;

/**
 * True when the grant is ACTIVE, has not been revoked and has not expired.
 */
export function isGrantActive(grant: GrantLike | null | undefined, now: Date = new Date()): boolean {
  if (!grant) return false;
  if (grant.status !== GrantStatus.ACTIVE) return false;
  if (grant.revokedAt) return false;
  if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= now.getTime()) return false;
  return true;
}

/**
 * True when the grant's record list names the record explicitly or contains
 * the wildcard. Does NOT check status, expiry or patient ownership — use
 * {@link grantCoversRecord} for an access decision.
 */
export function grantListsRecord(grant: Pick<AccessGrant, 'recordIds'>, recordId: string): boolean {
  const recordIds = grant?.recordIds ?? [];
  return recordIds.includes(WILDCARD_RECORD_ID) || recordIds.includes(recordId);
}

/**
 * Single source of truth for "does this grant give access to this record?".
 *
 * A grant covers a record when all of the following hold:
 *  - the grant is active (ACTIVE status, not revoked, not expired);
 *  - the grant was issued by the record's patient (`grant.patientId === patientId`),
 *    so a wildcard can never reach another patient's records;
 *  - `recordIds` contains the wildcard `'*'` or the record id itself.
 */
export function grantCoversRecord(
  grant: GrantLike | null | undefined,
  recordId: string,
  patientId: string,
  now: Date = new Date(),
): boolean {
  if (!isGrantActive(grant, now)) return false;
  if (!patientId || grant.patientId !== patientId) return false;
  return grantListsRecord(grant, recordId);
}
