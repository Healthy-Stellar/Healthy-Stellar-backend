import { Test, TestingModule } from '@nestjs/testing';
import { AccessControlService } from './access-control.service';
import { EmergencyAccessCleanupService } from './emergency-access-cleanup.service';

describe('EmergencyAccessCleanupService', () => {
  let service: EmergencyAccessCleanupService;

  const accessControlService = {
    expireEmergencyGrants: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyAccessCleanupService,
        {
          provide: AccessControlService,
          useValue: accessControlService,
        },
      ],
    }).compile();

    service = module.get<EmergencyAccessCleanupService>(EmergencyAccessCleanupService);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('runs cleanup every 15 minutes', async () => {
    service.onModuleInit();

    jest.advanceTimersByTime(15 * 60 * 1000);
    await Promise.resolve();

    expect(accessControlService.expireEmergencyGrants).toHaveBeenCalledTimes(1);
  });
});
