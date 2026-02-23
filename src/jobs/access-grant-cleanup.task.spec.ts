import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccessGrantCleanupTask } from './access-grant-cleanup.task';
import { AccessGrant, GrantStatus } from '../access-control/entities/access-grant.entity';
import { NotificationsService } from '../notifications/services/notifications.service';
import { RedisLockService } from '../common/utils/redis-lock.service';

describe('AccessGrantCleanupTask', () => {
  let task: AccessGrantCleanupTask;
  let mockRepo: { find: jest.Mock; save: jest.Mock };
  let mockNotifications: { emitAccessRevoked: jest.Mock };
  let mockRedisLock: { acquireLock: jest.Mock; releaseLock: jest.Mock };

  beforeEach(async () => {
    mockRepo = {
      find: jest.fn(),
      save: jest.fn(),
    };

    mockNotifications = {
      emitAccessRevoked: jest.fn(),
    };

    mockRedisLock = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessGrantCleanupTask,
        { provide: getRepositoryToken(AccessGrant), useValue: mockRepo },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: RedisLockService, useValue: mockRedisLock },
      ],
    }).compile();

    task = module.get<AccessGrantCleanupTask>(AccessGrantCleanupTask);
  });

  it('marks expired grants and emits access.revoked event', async () => {
    const fakeGrants = [
      {
        id: '1',
        patientId: 'patient-1',
        granteeId: 'grantee-1',
        status: GrantStatus.ACTIVE,
        expiresAt: new Date('2020-01-01'),
      } as AccessGrant,
      {
        id: '2',
        patientId: 'patient-2',
        granteeId: 'grantee-2',
        status: GrantStatus.ACTIVE,
        expiresAt: new Date('2021-01-01'),
      } as AccessGrant,
    ];

    mockRepo.find.mockResolvedValue(fakeGrants);
    mockRepo.save.mockResolvedValue(undefined);

    await task.handleExpiredGrants();

    expect(mockRepo.find).toHaveBeenCalledTimes(1);
    expect(mockRepo.save).toHaveBeenCalledTimes(2);
    expect(fakeGrants[0].status).toBe(GrantStatus.EXPIRED);
    expect(fakeGrants[1].status).toBe(GrantStatus.EXPIRED);
    expect(mockNotifications.emitAccessRevoked).toHaveBeenCalledWith(
      'patient-1',
      '1',
      expect.objectContaining({ reason: 'Grant expired' }),
    );
    expect(mockNotifications.emitAccessRevoked).toHaveBeenCalledWith(
      'patient-2',
      '2',
      expect.objectContaining({ reason: 'Grant expired' }),
    );
    expect(mockRedisLock.releaseLock).toHaveBeenCalled();
  });

  it('skips execution when lock is not acquired', async () => {
    mockRedisLock.acquireLock.mockResolvedValue(false);

    await task.handleExpiredGrants();

    expect(mockRepo.find).not.toHaveBeenCalled();
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockNotifications.emitAccessRevoked).not.toHaveBeenCalled();
    expect(mockRedisLock.releaseLock).not.toHaveBeenCalled();
  });
});
