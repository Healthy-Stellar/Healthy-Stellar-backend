import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { AccessGrant, AccessLevel, GrantStatus } from '../entities/access-grant.entity';
import { AccessControlService } from './access-control.service';
import { SorobanQueueService } from './soroban-queue.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

describe('AccessControlService', () => {
  let service: AccessControlService;
  let repository: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };

  let notificationsService: { emitAccessGranted: jest.Mock; emitAccessRevoked: jest.Mock };
  let sorobanQueueService: { dispatchGrant: jest.Mock; dispatchRevoke: jest.Mock };

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

    notificationsService = {
      emitAccessGranted: jest.fn(),
      emitAccessRevoked: jest.fn(),
    };

    sorobanQueueService = {
      dispatchGrant: jest.fn().mockResolvedValue('tx-grant-1'),
      dispatchRevoke: jest.fn().mockResolvedValue('tx-revoke-1'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessControlService,
        { provide: getRepositoryToken(AccessGrant), useValue: repository },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: SorobanQueueService, useValue: sorobanQueueService },
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
      revocationReason: null,
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

    await expect(service.revokeAccess('missing-id', patientId, 'reason')).rejects.toThrow(NotFoundException);
  });
});
