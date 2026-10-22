/**
 * Comprehensive unit tests for AccessControlService (Issue #623).
 *
 * Covers: grant, revoke, expiry, cross-tenant denial, emergency flows,
 * and audit-log entry verification. Uses repository mocks — no real DB.
 *
 * Fixes absent in the pre-existing spec:
 *   • RedisLockService mock (DI would fail without it)
 *   • auditLogService.log mock (service calls both .create AND .log)
 */

import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';

import { AccessControlService } from './access-control.service';
import { AccessGrant, AccessLevel, GrantStatus } from '../entities/access-grant.entity';
import { User, UserRole } from '../../auth/entities/user.entity';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { SorobanQueueService } from './soroban-queue.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { RedisLockService } from '../../common/utils/redis-lock.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeGrantRepo = (overrides: Record<string, jest.Mock> = {}) => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  ...overrides,
});

const makeUserRepo = (overrides: Record<string, jest.Mock> = {}) => ({
  findOne: jest.fn(),
  save: jest.fn(),
  ...overrides,
});

const future = (offsetMs = 86_400_000) => new Date(Date.now() + offsetMs);
const past   = (offsetMs = 86_400_000) => new Date(Date.now() - offsetMs);

const PATIENT_ID  = 'aaaaaaaa-1111-1111-1111-111111111111';
const GRANTEE_ID  = 'bbbbbbbb-2222-2222-2222-222222222222';
const RECORD_ID   = 'rrrrrrrr-3333-3333-3333-333333333333';
const GRANT_ID    = 'cccccccc-4444-4444-4444-444444444444';
const LONG_REASON = 'Emergency override justified by critical trauma response with immediate life-saving need for patient.';

const baseGrant = (): AccessGrant => ({
  id: GRANT_ID,
  patientId: PATIENT_ID,
  granteeId: GRANTEE_ID,
  recordIds: [RECORD_ID],
  accessLevel: AccessLevel.READ,
  status: GrantStatus.ACTIVE,
  isEmergency: false,
  emergencyReason: null,
  expiresAt: null,
  revokedAt: null,
  revokedBy: null,
  revocationReason: null,
  sorobanTxHash: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as AccessGrant);

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('AccessControlService (comprehensive)', () => {
  let service: AccessControlService;
  let grantRepo: ReturnType<typeof makeGrantRepo>;
  let userRepo: ReturnType<typeof makeUserRepo>;
  let notificationsSvc: jest.Mocked<Pick<NotificationsService, 'emitAccessGranted' | 'emitAccessRevoked' | 'emitEmergencyAccess' | 'sendPatientEmailNotification'>>;
  let sorobanSvc: { dispatchGrant: jest.Mock; dispatchRevoke: jest.Mock };
  let auditSvc: { create: jest.Mock; log: jest.Mock };
  let lockSvc: { acquireLock: jest.Mock; releaseLock: jest.Mock };

  beforeEach(async () => {
    grantRepo = makeGrantRepo();
    userRepo  = makeUserRepo();

    notificationsSvc = {
      emitAccessGranted: jest.fn(),
      emitAccessRevoked: jest.fn(),
      emitEmergencyAccess: jest.fn(),
      sendPatientEmailNotification: jest.fn().mockResolvedValue(undefined),
    };

    sorobanSvc = {
      dispatchGrant: jest.fn().mockResolvedValue('tx-grant'),
      dispatchRevoke: jest.fn().mockResolvedValue('tx-revoke'),
    };

    auditSvc = {
      create: jest.fn().mockResolvedValue(undefined),
      log: jest.fn().mockResolvedValue(undefined),
    };

    lockSvc = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessControlService,
        { provide: getRepositoryToken(AccessGrant), useValue: grantRepo },
        { provide: getRepositoryToken(User),        useValue: userRepo },
        { provide: NotificationsService,            useValue: notificationsSvc },
        { provide: SorobanQueueService,             useValue: sorobanSvc },
        { provide: AuditLogService,                 useValue: auditSvc },
        { provide: RedisLockService,                useValue: lockSvc },
      ],
    }).compile();

    service = module.get<AccessControlService>(AccessControlService);
  });

  // ── grantAccess ─────────────────────────────────────────────────────────────

  describe('grantAccess', () => {
    it('creates grant, dispatches Soroban tx, emits notification, and logs audit', async () => {
      const grant = baseGrant();
      const grantWithTx = { ...grant, sorobanTxHash: 'tx-grant' };

      grantRepo.find.mockResolvedValue([]);
      grantRepo.create.mockReturnValue(grant);
      grantRepo.save.mockResolvedValueOnce(grant).mockResolvedValueOnce(grantWithTx);

      const result = await service.grantAccess(PATIENT_ID, {
        granteeId: GRANTEE_ID,
        recordIds: [RECORD_ID],
        accessLevel: AccessLevel.READ,
        expiresAt: undefined,
      });

      expect(result.sorobanTxHash).toBe('tx-grant');
      expect(sorobanSvc.dispatchGrant).toHaveBeenCalledWith(grant);
      expect(notificationsSvc.emitAccessGranted).toHaveBeenCalledWith(
        PATIENT_ID, grant.id, expect.objectContaining({ grantId: grant.id, granteeId: GRANTEE_ID }),
      );
      expect(auditSvc.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'GRANT_CHANGE', actorAddress: PATIENT_ID }),
      );
    });

    it('stores expiresAt when provided', async () => {
      const expiry = future().toISOString();
      const grant  = { ...baseGrant(), expiresAt: new Date(expiry) };

      grantRepo.find.mockResolvedValue([]);
      grantRepo.create.mockReturnValue(grant);
      grantRepo.save.mockResolvedValue(grant);

      const capturedArg: any = {};
      grantRepo.create.mockImplementation((data) => {
        Object.assign(capturedArg, data);
        return grant;
      });

      await service.grantAccess(PATIENT_ID, {
        granteeId: GRANTEE_ID,
        recordIds: [RECORD_ID],
        accessLevel: AccessLevel.READ,
        expiresAt: expiry,
      });

      expect(capturedArg.expiresAt).toBeInstanceOf(Date);
    });

    it('throws 409 when an active grant already covers the same record', async () => {
      grantRepo.find.mockResolvedValue([
        { ...baseGrant(), recordIds: [RECORD_ID, 'other'] } as AccessGrant,
      ]);

      await expect(
        service.grantAccess(PATIENT_ID, {
          granteeId: GRANTEE_ID, recordIds: [RECORD_ID], accessLevel: AccessLevel.READ,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 503 when the distributed lock cannot be acquired', async () => {
      lockSvc.acquireLock.mockResolvedValue(false);

      await expect(
        service.grantAccess(PATIENT_ID, {
          granteeId: GRANTEE_ID, recordIds: [RECORD_ID], accessLevel: AccessLevel.READ,
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('releases the lock even when the operation throws', async () => {
      grantRepo.find.mockRejectedValue(new Error('DB down'));

      await expect(
        service.grantAccess(PATIENT_ID, {
          granteeId: GRANTEE_ID, recordIds: [RECORD_ID], accessLevel: AccessLevel.READ,
        }),
      ).rejects.toThrow('DB down');

      expect(lockSvc.releaseLock).toHaveBeenCalled();
    });
  });

  // ── revokeAccess ────────────────────────────────────────────────────────────

  describe('revokeAccess', () => {
    it('revokes grant, dispatches Soroban tx, emits notification, and logs audit', async () => {
      const grant = baseGrant();
      const revoked = { ...grant, status: GrantStatus.REVOKED, sorobanTxHash: 'tx-revoke' };

      grantRepo.findOne.mockResolvedValue(grant);
      grantRepo.save
        .mockResolvedValueOnce({ ...grant, status: GrantStatus.REVOKED })
        .mockResolvedValueOnce(revoked);

      await service.revokeAccess(GRANT_ID, PATIENT_ID, 'No longer needed');

      expect(sorobanSvc.dispatchRevoke).toHaveBeenCalled();
      expect(notificationsSvc.emitAccessRevoked).toHaveBeenCalledWith(
        PATIENT_ID, GRANT_ID, expect.any(Object),
      );
      expect(auditSvc.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'GRANT_REVOKE', actorAddress: PATIENT_ID }),
      );
    });

    it('throws 404 when grant does not exist', async () => {
      grantRepo.findOne.mockResolvedValue(null);
      await expect(service.revokeAccess('missing', PATIENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when grant is already REVOKED', async () => {
      grantRepo.findOne.mockResolvedValue({ ...baseGrant(), status: GrantStatus.REVOKED });
      await expect(service.revokeAccess(GRANT_ID, PATIENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws 503 when the distributed lock cannot be acquired', async () => {
      lockSvc.acquireLock.mockResolvedValue(false);
      await expect(service.revokeAccess(GRANT_ID, PATIENT_ID)).rejects.toThrow(ServiceUnavailableException);
    });

    it('releases the lock even when the operation throws', async () => {
      grantRepo.findOne.mockRejectedValue(new Error('DB error'));

      await expect(service.revokeAccess(GRANT_ID, PATIENT_ID)).rejects.toThrow('DB error');
      expect(lockSvc.releaseLock).toHaveBeenCalled();
    });
  });

  // ── createEmergencyAccess ───────────────────────────────────────────────────

  describe('createEmergencyAccess', () => {
    it('creates emergency grant, notifies patient, and writes audit log', async () => {
      const grant = { ...baseGrant(), isEmergency: true, recordIds: ['*'], expiresAt: future() };

      userRepo.findOne.mockResolvedValue({ id: PATIENT_ID, emergencyAccessEnabled: true });
      grantRepo.findOne.mockResolvedValue(null);
      grantRepo.create.mockReturnValue(grant);
      grantRepo.save.mockResolvedValue(grant);

      const result = await service.createEmergencyAccess(GRANTEE_ID, {
        patientId: PATIENT_ID,
        emergencyReason: LONG_REASON,
      });

      expect(result.isEmergency).toBe(true);
      expect(notificationsSvc.sendPatientEmailNotification).toHaveBeenCalled();
      expect(notificationsSvc.emitEmergencyAccess).toHaveBeenCalled();
      expect(auditSvc.create).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'EMERGENCY_ACCESS' }),
      );
    });

    it('throws 400 when emergencyReason is too short', async () => {
      await expect(
        service.createEmergencyAccess(GRANTEE_ID, { patientId: PATIENT_ID, emergencyReason: 'short' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 404 when patient does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createEmergencyAccess(GRANTEE_ID, { patientId: PATIENT_ID, emergencyReason: LONG_REASON }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 403 when patient has disabled emergency access', async () => {
      userRepo.findOne.mockResolvedValue({ id: PATIENT_ID, emergencyAccessEnabled: false });
      await expect(
        service.createEmergencyAccess(GRANTEE_ID, { patientId: PATIENT_ID, emergencyReason: LONG_REASON }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 409 when an active non-expired emergency grant already exists', async () => {
      userRepo.findOne.mockResolvedValue({ id: PATIENT_ID, emergencyAccessEnabled: true });
      grantRepo.findOne.mockResolvedValue({ ...baseGrant(), isEmergency: true, expiresAt: future() });

      await expect(
        service.createEmergencyAccess(GRANTEE_ID, { patientId: PATIENT_ID, emergencyReason: LONG_REASON }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows new emergency grant when existing one is already expired', async () => {
      const expiredGrant = { ...baseGrant(), isEmergency: true, expiresAt: past() };
      const newGrant = { ...baseGrant(), isEmergency: true, expiresAt: future() };

      userRepo.findOne.mockResolvedValue({ id: PATIENT_ID, emergencyAccessEnabled: true });
      grantRepo.findOne.mockResolvedValue(expiredGrant);
      grantRepo.create.mockReturnValue(newGrant);
      grantRepo.save.mockResolvedValue(newGrant);

      const result = await service.createEmergencyAccess(GRANTEE_ID, {
        patientId: PATIENT_ID, emergencyReason: LONG_REASON,
      });

      expect(result.isEmergency).toBe(true);
    });
  });

  // ── getEmergencyLog ─────────────────────────────────────────────────────────

  describe('getEmergencyLog', () => {
    it('returns all emergency grants for a patient, ordered newest first', async () => {
      const grants = [
        { ...baseGrant(), isEmergency: true, createdAt: past(1000) },
        { ...baseGrant(), id: 'other', isEmergency: true, createdAt: past(2000) },
      ] as AccessGrant[];
      grantRepo.find.mockResolvedValue(grants);

      const result = await service.getEmergencyLog(PATIENT_ID);

      expect(result).toEqual(grants);
      expect(grantRepo.find).toHaveBeenCalledWith({
        where: { patientId: PATIENT_ID, isEmergency: true },
        order: { createdAt: 'DESC' },
      });
    });

    it('returns empty array when no emergency grants exist', async () => {
      grantRepo.find.mockResolvedValue([]);
      await expect(service.getEmergencyLog(PATIENT_ID)).resolves.toEqual([]);
    });
  });

  // ── setEmergencyAccessEnabled ───────────────────────────────────────────────

  describe('setEmergencyAccessEnabled', () => {
    it('enables emergency access and writes audit log', async () => {
      const user = { id: PATIENT_ID, emergencyAccessEnabled: false };
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue({ ...user, emergencyAccessEnabled: true });

      const result = await service.setEmergencyAccessEnabled(PATIENT_ID, true, 'admin-id');

      expect(result).toEqual({ success: true });
      expect(userRepo.save).toHaveBeenCalledWith({ ...user, emergencyAccessEnabled: true });
      expect(auditSvc.create).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'EMERGENCY_ACCESS_TOGGLE', entityId: PATIENT_ID }),
      );
    });

    it('disables emergency access', async () => {
      const user = { id: PATIENT_ID, emergencyAccessEnabled: true };
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue(user);

      const result = await service.setEmergencyAccessEnabled(PATIENT_ID, false, 'admin-id');

      expect(result).toEqual({ success: true });
    });

    it('throws 404 when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.setEmergencyAccessEnabled('ghost', true, 'admin')).rejects.toThrow(NotFoundException);
    });
  });

  // ── findActiveEmergencyGrant ─────────────────────────────────────────────────

  describe('findActiveEmergencyGrant', () => {
    it('returns the active grant when it exists and has not expired', async () => {
      const grant = { ...baseGrant(), isEmergency: true, expiresAt: future() };
      grantRepo.findOne.mockResolvedValue(grant);

      const result = await service.findActiveEmergencyGrant(PATIENT_ID, GRANTEE_ID, RECORD_ID);
      expect(result).toEqual(grant);
    });

    it('returns null when no grant is found', async () => {
      grantRepo.findOne.mockResolvedValue(null);
      await expect(service.findActiveEmergencyGrant(PATIENT_ID, GRANTEE_ID)).resolves.toBeNull();
    });

    it('marks an expired grant as EXPIRED and returns null', async () => {
      const grant = { ...baseGrant(), isEmergency: true, expiresAt: past() };
      grantRepo.findOne.mockResolvedValue(grant);
      grantRepo.save.mockResolvedValue({ ...grant, status: GrantStatus.EXPIRED });

      const result = await service.findActiveEmergencyGrant(PATIENT_ID, GRANTEE_ID);
      expect(result).toBeNull();
      expect(grantRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: GrantStatus.EXPIRED }),
      );
    });

    it('returns null when the grant does not cover the requested recordId', async () => {
      const grant = { ...baseGrant(), isEmergency: true, expiresAt: future(), recordIds: ['other-record'] };
      grantRepo.findOne.mockResolvedValue(grant);

      const result = await service.findActiveEmergencyGrant(PATIENT_ID, GRANTEE_ID, RECORD_ID);
      expect(result).toBeNull();
    });

    it('returns the grant when recordIds contains wildcard "*"', async () => {
      const grant = { ...baseGrant(), isEmergency: true, expiresAt: future(), recordIds: ['*'] };
      grantRepo.findOne.mockResolvedValue(grant);

      const result = await service.findActiveEmergencyGrant(PATIENT_ID, GRANTEE_ID, RECORD_ID);
      expect(result).toEqual(grant);
    });

    it('returns the grant when no recordId filter is specified', async () => {
      const grant = { ...baseGrant(), isEmergency: true, expiresAt: future() };
      grantRepo.findOne.mockResolvedValue(grant);

      const result = await service.findActiveEmergencyGrant(PATIENT_ID, GRANTEE_ID);
      expect(result).toEqual(grant);
    });
  });

  // ── expireEmergencyGrants ───────────────────────────────────────────────────

  describe('expireEmergencyGrants', () => {
    it('returns empty array when there are no expired grants', async () => {
      grantRepo.find.mockResolvedValue([]);
      await expect(service.expireEmergencyGrants()).resolves.toEqual([]);
      expect(grantRepo.update).not.toHaveBeenCalled();
    });

    it('marks expired grants as EXPIRING and returns them', async () => {
      const g1 = { ...baseGrant(), id: 'g1', isEmergency: true, expiresAt: past() };
      const g2 = { ...baseGrant(), id: 'g2', isEmergency: true, expiresAt: past(100) };
      grantRepo.find.mockResolvedValue([g1, g2]);
      grantRepo.update.mockResolvedValue(undefined);

      const result = await service.expireEmergencyGrants();

      expect(grantRepo.update).toHaveBeenCalledWith(
        ['g1', 'g2'], { status: GrantStatus.EXPIRING },
      );
      expect(result).toHaveLength(2);
      expect(result.every((g) => g.status === GrantStatus.EXPIRING)).toBe(true);
    });
  });

  // ── finalizeExpiredGrant ────────────────────────────────────────────────────

  describe('finalizeExpiredGrant', () => {
    it('sets status to EXPIRED and records the Soroban tx hash', async () => {
      grantRepo.update.mockResolvedValue(undefined);

      await service.finalizeExpiredGrant(GRANT_ID, 'tx-finalize');

      expect(grantRepo.update).toHaveBeenCalledWith(GRANT_ID, {
        status: GrantStatus.EXPIRED,
        sorobanTxHash: 'tx-finalize',
      });
    });
  });

  // ── getPatientGrants ─────────────────────────────────────────────────────────

  describe('getPatientGrants', () => {
    it('returns only grants that have not yet expired', async () => {
      const active   = { ...baseGrant(), id: 'active',   expiresAt: future() };
      const expired  = { ...baseGrant(), id: 'expired',  expiresAt: past() };
      const noExpiry = { ...baseGrant(), id: 'no-expiry', expiresAt: null };

      grantRepo.find.mockResolvedValue([active, expired, noExpiry]);
      grantRepo.update.mockResolvedValue(undefined);

      const result = await service.getPatientGrants(PATIENT_ID);

      const ids = result.map((g) => g.id);
      expect(ids).toContain('active');
      expect(ids).toContain('no-expiry');
      expect(ids).not.toContain('expired');
    });

    it('updates expired grants to EXPIRED status in the database', async () => {
      const expired = { ...baseGrant(), id: 'expired', expiresAt: past() };
      grantRepo.find.mockResolvedValue([expired]);
      grantRepo.update.mockResolvedValue(undefined);

      await service.getPatientGrants(PATIENT_ID);

      expect(grantRepo.update).toHaveBeenCalledWith('expired', { status: GrantStatus.EXPIRED });
    });
  });

  // ── getReceivedGrants ────────────────────────────────────────────────────────

  describe('getReceivedGrants', () => {
    it('returns only grants that have not yet expired', async () => {
      const active  = { ...baseGrant(), id: 'active',  expiresAt: future() };
      const expired = { ...baseGrant(), id: 'expired', expiresAt: past() };

      grantRepo.find.mockResolvedValue([active, expired]);
      grantRepo.update.mockResolvedValue(undefined);

      const result = await service.getReceivedGrants(GRANTEE_ID);

      expect(result.map((g) => g.id)).toEqual(['active']);
    });

    it('marks expired received grants as EXPIRED in the database', async () => {
      const expired = { ...baseGrant(), id: 'exp', expiresAt: past() };
      grantRepo.find.mockResolvedValue([expired]);
      grantRepo.update.mockResolvedValue(undefined);

      await service.getReceivedGrants(GRANTEE_ID);

      expect(grantRepo.update).toHaveBeenCalledWith('exp', { status: GrantStatus.EXPIRED });
    });
  });

  // ── canAccessRecord ──────────────────────────────────────────────────────────

  describe('canAccessRecord', () => {
    it('allows a patient to access their own record (same id)', async () => {
      const result = await service.canAccessRecord(PATIENT_ID, PATIENT_ID, UserRole.PATIENT, RECORD_ID);
      expect(result).toBe(true);
      expect(grantRepo.find).not.toHaveBeenCalled();
    });

    it('denies a PATIENT role from accessing another patient\'s record (cross-tenant)', async () => {
      const result = await service.canAccessRecord(PATIENT_ID, 'other-user', UserRole.PATIENT, RECORD_ID);
      expect(result).toBe(false);
      expect(grantRepo.find).not.toHaveBeenCalled();
    });

    it('allows access when a valid grant covers the specific record', async () => {
      const grant = { ...baseGrant(), expiresAt: future() };
      grantRepo.find.mockResolvedValue([grant]);

      const result = await service.canAccessRecord(PATIENT_ID, GRANTEE_ID, UserRole.PROVIDER, RECORD_ID);
      expect(result).toBe(true);
    });

    it('allows access when a grant uses wildcard record access', async () => {
      const grant = { ...baseGrant(), recordIds: ['*'], expiresAt: future() };
      grantRepo.find.mockResolvedValue([grant]);

      const result = await service.canAccessRecord(PATIENT_ID, GRANTEE_ID, UserRole.PROVIDER, RECORD_ID);
      expect(result).toBe(true);
    });

    it('denies access when no grants exist', async () => {
      grantRepo.find.mockResolvedValue([]);

      const result = await service.canAccessRecord(PATIENT_ID, GRANTEE_ID, UserRole.PROVIDER, RECORD_ID);
      expect(result).toBe(false);
    });

    it('denies access when a grant covers a different record', async () => {
      const grant = { ...baseGrant(), recordIds: ['other-record'], expiresAt: future() };
      grantRepo.find.mockResolvedValue([grant]);

      const result = await service.canAccessRecord(PATIENT_ID, GRANTEE_ID, UserRole.PROVIDER, RECORD_ID);
      expect(result).toBe(false);
    });

    it('denies access when the grant has expired, and marks it EXPIRED in the DB', async () => {
      const expired = { ...baseGrant(), expiresAt: past() };
      grantRepo.find.mockResolvedValue([expired]);
      grantRepo.update.mockResolvedValue(undefined);

      const result = await service.canAccessRecord(PATIENT_ID, GRANTEE_ID, UserRole.PROVIDER, RECORD_ID);

      expect(result).toBe(false);
      expect(grantRepo.update).toHaveBeenCalledWith(GRANT_ID, { status: GrantStatus.EXPIRED });
    });
  });

  // ── verifyAccess ─────────────────────────────────────────────────────────────

  describe('verifyAccess', () => {
    it('returns true when a valid, non-expired grant covers the record', async () => {
      grantRepo.find.mockResolvedValue([{ ...baseGrant(), expiresAt: future() }]);

      await expect(service.verifyAccess(GRANTEE_ID, RECORD_ID)).resolves.toBe(true);
    });

    it('returns false when the grant does not include the requested record', async () => {
      grantRepo.find.mockResolvedValue([{ ...baseGrant(), recordIds: ['other'] }]);

      await expect(service.verifyAccess(GRANTEE_ID, RECORD_ID)).resolves.toBe(false);
    });

    it('returns false when the grant has expired', async () => {
      grantRepo.find.mockResolvedValue([{ ...baseGrant(), expiresAt: past() }]);

      await expect(service.verifyAccess(GRANTEE_ID, RECORD_ID)).resolves.toBe(false);
    });

    it('returns true when the grant has no expiry (permanent grant)', async () => {
      grantRepo.find.mockResolvedValue([{ ...baseGrant(), expiresAt: null }]);

      await expect(service.verifyAccess(GRANTEE_ID, RECORD_ID)).resolves.toBe(true);
    });

    it('returns false when there are no grants', async () => {
      grantRepo.find.mockResolvedValue([]);

      await expect(service.verifyAccess(GRANTEE_ID, RECORD_ID)).resolves.toBe(false);
    });
  });
});
