import { Test, TestingModule } from '@nestjs/testing';
import { EmergencyAccessCleanupService } from './emergency-access-cleanup.service';
import { AccessControlService } from './access-control.service';
import { SorobanQueueService } from './soroban-queue.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AccessGrant, GrantStatus } from '../entities/access-grant.entity';

const makeGrant = (overrides: Partial<AccessGrant> = {}): AccessGrant =>
  ({
    id: 'grant-1',
    patientId: 'patient-1',
    granteeId: 'grantee-1',
    recordIds: ['*'],
    status: GrantStatus.EXPIRING,
    ...overrides,
  }) as AccessGrant;

describe('EmergencyAccessCleanupService — expiry → revoke cycle', () => {
  let service: EmergencyAccessCleanupService;
  let accessControlService: jest.Mocked<Pick<AccessControlService, 'expireEmergencyGrants' | 'finalizeExpiredGrant'>>;
  let sorobanQueueService: jest.Mocked<Pick<SorobanQueueService, 'dispatchRevoke'>>;
  let notificationsService: jest.Mocked<Pick<NotificationsService, 'sendPatientEmailNotification'>>;

  beforeEach(async () => {
    accessControlService = {
      expireEmergencyGrants: jest.fn(),
      finalizeExpiredGrant: jest.fn().mockResolvedValue(undefined),
    };
    sorobanQueueService = {
      dispatchRevoke: jest.fn().mockResolvedValue('0xabc123'),
    };
    notificationsService = {
      sendPatientEmailNotification: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyAccessCleanupService,
        { provide: AccessControlService, useValue: accessControlService },
        { provide: SorobanQueueService, useValue: sorobanQueueService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(EmergencyAccessCleanupService);
  });

  it('marks grants EXPIRING, dispatches revoke, then finalizes to EXPIRED', async () => {
    const grant = makeGrant();
    accessControlService.expireEmergencyGrants.mockResolvedValue([grant]);

    await service.runCleanup();

    expect(accessControlService.expireEmergencyGrants).toHaveBeenCalledTimes(1);
    expect(sorobanQueueService.dispatchRevoke).toHaveBeenCalledWith(grant);
    expect(accessControlService.finalizeExpiredGrant).toHaveBeenCalledWith(grant.id, '0xabc123');
    expect(notificationsService.sendPatientEmailNotification).not.toHaveBeenCalled();
    expect(service.lockedGranteeIds.size).toBe(0);
  });

  it('does nothing when no grants are expiring', async () => {
    accessControlService.expireEmergencyGrants.mockResolvedValue([]);

    await service.runCleanup();

    expect(sorobanQueueService.dispatchRevoke).not.toHaveBeenCalled();
  });

  it('retries up to MAX_REVOKE_RETRIES then locks grantee and sends alert', async () => {
    const grant = makeGrant();
    accessControlService.expireEmergencyGrants.mockResolvedValue([grant]);
    sorobanQueueService.dispatchRevoke.mockRejectedValue(new Error('Soroban timeout'));

    await service.runCleanup();

    // 3 attempts total
    expect(sorobanQueueService.dispatchRevoke).toHaveBeenCalledTimes(3);
    expect(accessControlService.finalizeExpiredGrant).not.toHaveBeenCalled();

    // Circuit-breaker: grantee locked
    expect(service.lockedGranteeIds.has(grant.granteeId)).toBe(true);

    // Alert sent
    expect(notificationsService.sendPatientEmailNotification).toHaveBeenCalledWith(
      grant.patientId,
      expect.stringContaining('ALERT'),
      expect.stringContaining(grant.id),
    );
  });

  it('succeeds on second attempt after initial failure', async () => {
    const grant = makeGrant();
    accessControlService.expireEmergencyGrants.mockResolvedValue([grant]);
    sorobanQueueService.dispatchRevoke
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('0xretried');

    await service.runCleanup();

    expect(sorobanQueueService.dispatchRevoke).toHaveBeenCalledTimes(2);
    expect(accessControlService.finalizeExpiredGrant).toHaveBeenCalledWith(grant.id, '0xretried');
    expect(service.lockedGranteeIds.size).toBe(0);
  });

  it('runs cleanup every 15 minutes via interval', async () => {
    jest.useFakeTimers();
    accessControlService.expireEmergencyGrants.mockResolvedValue([]);

    service.onModuleInit();
    jest.advanceTimersByTime(15 * 60 * 1000);
    await Promise.resolve();

    expect(accessControlService.expireEmergencyGrants).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();
    jest.useRealTimers();
  });
});
