import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { AccessGrant, AccessLevel, GrantStatus } from '../entities/access-grant.entity';
import { AccessControlService } from './access-control.service';
import { SorobanQueueService } from './soroban-queue.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { User } from '../../auth/entities/user.entity';
import { AuditLogService } from '../../common/services/audit-log.service';
import { RedisLockService } from '../../common/utils/redis-lock.service';

describe('AccessControlService', () => {
  let service: AccessControlService;
  let repository: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let userRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };

  let notificationsService: {
    emitAccessGranted: jest.Mock;
    emitAccessRevoked: jest.Mock;
    emitEmergencyAccess: jest.Mock;
    sendPatientEmailNotification: jest.Mock;
  };
  let sorobanQueueService: { dispatchGrant: jest.Mock; dispatchRevoke: jest.Mock };
  let auditLogService: { create: jest.Mock; log: jest.Mock };

  const patientId = 'a1a1a1a1-1111-1111-1111-111111111111';
  const granteeId = 'b2b2b2b2-2222-2222-2222-222222222222';

  beforeEach(async () => {
    repository = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    userRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    notificationsService = {
      emitAccessGranted: jest.fn(),
      emitAccessRevoked: jest.fn(),
      emitEmergencyAccess: jest.fn(),
      sendPatientEmailNotification: jest.fn(),
    };

    sorobanQueueService = {
      dispatchGrant: jest.fn().mockResolvedValue('tx-grant-1'),
      dispatchRevoke: jest.fn().mockResolvedValue('tx-revoke-1'),
    };
    auditLogService = {
      create: jest.fn(),
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessControlService,
        { provide: getRepositoryToken(AccessGrant), useValue: repository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: SorobanQueueService, useValue: sorobanQueueService },
        { provide: AuditLogService, useValue: auditLogService },
        {
          provide: RedisLockService,
          useValue: {
            acquireLock: jest.fn().mockResolvedValue(true),
            releaseLock: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AccessControlService>(AccessControlService);
  });

  it('creates access grant and emits notification/event + soroban tx', async () => {
    repository.find.mockResolvedValue([]);

    const created: AccessGrant = {
      id: 'c3c3c3c3-3333-3333-3333-333333333333',
      patientId,
      granteeId,
      recordIds: ['r1'],
      accessLevel: AccessLevel.READ,
      status: GrantStatus.ACTIVE,
      expiresAt: null,
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
      sorobanTxHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AccessGrant;

    repository.create.mockReturnValue(created);
    repository.save
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce({ ...created, sorobanTxHash: 'tx-grant-1' });

    const result = await service.grantAccess(patientId, {
      granteeId,
      recordIds: ['r1'],
      accessLevel: AccessLevel.READ,
      expiresAt: undefined,
    });

    expect(result.sorobanTxHash).toBe('tx-grant-1');
    expect(sorobanQueueService.dispatchGrant).toHaveBeenCalled();
    expect(notificationsService.emitAccessGranted).toHaveBeenCalledWith(
      patientId,
      created.id,
      expect.objectContaining({
        grantId: created.id,
        granteeId,
      }),
    );
  });

  it('throws 409 on duplicate record grant', async () => {
    repository.find.mockResolvedValue([
      {
        id: 'existing',
        patientId,
        granteeId,
        recordIds: ['r1', 'r2'],
        status: GrantStatus.ACTIVE,
      } as AccessGrant,
    ]);

    await expect(
      service.grantAccess(patientId, {
        granteeId,
        recordIds: ['r2'],
        accessLevel: AccessLevel.READ,
        expiresAt: undefined,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('revokes grant and emits notification/soroban event', async () => {
    const existing = {
      id: 'c3c3c3c3-3333-3333-3333-333333333333',
      patientId,
      granteeId,
      status: GrantStatus.ACTIVE,
      recordIds: ['r1'],
      accessLevel: AccessLevel.READ,
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
      sorobanTxHash: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AccessGrant;

    repository.findOne.mockResolvedValue(existing);
    repository.save
      .mockResolvedValueOnce({ ...existing, status: GrantStatus.REVOKED })
      .mockResolvedValueOnce({
        ...existing,
        status: GrantStatus.REVOKED,
        sorobanTxHash: 'tx-revoke-1',
      });

    await service.revokeAccess(existing.id, patientId, 'No longer needed');

    expect(sorobanQueueService.dispatchRevoke).toHaveBeenCalled();
    expect(notificationsService.emitAccessRevoked).toHaveBeenCalledWith(
      patientId,
      existing.id,
      expect.any(Object),
    );
  });

  it('throws 404 on missing grant on revoke', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.revokeAccess('missing-id', patientId, 'reason')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates emergency grant, notifies patient, and logs audit entry', async () => {
    userRepository.findOne.mockResolvedValue({
      id: patientId,
      emergencyAccessEnabled: true,
    });
    repository.findOne.mockResolvedValue(null);

    const emergencyGrant = {
      id: 'd4d4d4d4-4444-4444-4444-444444444444',
      patientId,
      granteeId,
      recordIds: ['*'],
      accessLevel: AccessLevel.READ_WRITE,
      status: GrantStatus.ACTIVE,
      isEmergency: true,
      emergencyReason:
        'Emergency override justified by critical trauma response with immediate life-saving need.',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AccessGrant;

    repository.create.mockReturnValue(emergencyGrant);
    repository.save.mockResolvedValue(emergencyGrant);

    const result = await service.createEmergencyAccess(granteeId, {
      patientId,
      emergencyReason:
        'Emergency override justified by critical trauma response with immediate life-saving need.',
    });

    expect(result.isEmergency).toBe(true);
    expect(notificationsService.sendPatientEmailNotification).toHaveBeenCalled();
    expect(notificationsService.emitEmergencyAccess).toHaveBeenCalled();
    expect(auditLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'EMERGENCY_ACCESS' }),
    );
  });

  describe('verifyAccess', () => {
    const requesterId = 'requester-123';
    const recordId = 'record-456';

    const grant = (overrides: Partial<AccessGrant> = {}) =>
      ({
        id: 'grant-789',
        patientId,
        granteeId: requesterId,
        recordIds: [recordId, 'other-record'],
        status: GrantStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        ...overrides,
      }) as AccessGrant;

    it('returns true when a valid grant names the record', async () => {
      repository.find.mockResolvedValue([grant()]);

      await expect(service.verifyAccess(requesterId, recordId, patientId)).resolves.toBe(true);
      expect(repository.find).toHaveBeenCalledWith({
        where: { granteeId: requesterId, patientId, status: GrantStatus.ACTIVE },
      });
    });

    it('returns true for a wildcard grant from the record\'s patient', async () => {
      repository.find.mockResolvedValue([grant({ recordIds: ['*'] })]);

      await expect(service.verifyAccess(requesterId, recordId, patientId)).resolves.toBe(true);
    });

    it('returns false for a wildcard grant from a different patient', async () => {
      repository.find.mockResolvedValue([grant({ recordIds: ['*'], patientId: 'other-patient' })]);

      await expect(service.verifyAccess(requesterId, recordId, patientId)).resolves.toBe(false);
    });

    it('returns false when no grant exists', async () => {
      repository.find.mockResolvedValue([]);

      await expect(service.verifyAccess(requesterId, recordId, patientId)).resolves.toBe(false);
    });

    it('returns false when the grant does not include the record', async () => {
      repository.find.mockResolvedValue([grant({ recordIds: ['other-record-1', 'other-record-2'] })]);

      await expect(service.verifyAccess(requesterId, recordId, patientId)).resolves.toBe(false);
    });

    it('returns false when the grant is expired', async () => {
      repository.find.mockResolvedValue([grant({ expiresAt: new Date(Date.now() - 86400000) })]);

      await expect(service.verifyAccess(requesterId, recordId, patientId)).resolves.toBe(false);
    });

    it('returns false when the grant is revoked', async () => {
      repository.find.mockResolvedValue([grant({ revokedAt: new Date() })]);

      await expect(service.verifyAccess(requesterId, recordId, patientId)).resolves.toBe(false);
    });

    it('returns true when the grant has no expiration', async () => {
      repository.find.mockResolvedValue([grant({ expiresAt: null })]);

      await expect(service.verifyAccess(requesterId, recordId, patientId)).resolves.toBe(true);
    });
  });
});
