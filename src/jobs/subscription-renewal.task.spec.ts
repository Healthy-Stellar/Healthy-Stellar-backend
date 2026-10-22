import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SubscriptionRenewalTask } from './subscription-renewal.task';
import { PatientSubscription } from '../billing/entities/patient-subscription.entity';
import { Billing } from '../billing/entities/billing.entity';
import { BillingLineItem } from '../billing/entities/billing-line-item.entity';
import { Payment } from '../billing/entities/payment.entity';
import { SubscriptionService } from '../billing/services/subscription.service';
import { PaymentService } from '../billing/services/payment.service';
import { SubscriptionStatus, PaymentStatus, SubscriptionCadence } from '../common/enums';
import { RedisLockService } from '../common/utils/redis-lock.service';

describe('SubscriptionRenewalTask', () => {
  let task: SubscriptionRenewalTask;
  let subscriptionRepo: Repository<PatientSubscription>;
  let subscriptionService: SubscriptionService;
  let redisLock: RedisLockService;

  const mockSubscriptionRepo = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockBillingRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockLineItemRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockPaymentRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    manager: {
      query: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    },
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };

  const mockSubscriptionService = {
    getSubscriptionsDueForRenewal: jest.fn(),
    resetFailedPaymentCount: jest.fn(),
    updateNextBillingDate: jest.fn(),
    incrementFailedPaymentCount: jest.fn(),
  };

  const mockPaymentService = {
    processPayment: jest.fn(),
  };

  const mockRedisLock = {
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionRenewalTask,
        {
          provide: getRepositoryToken(PatientSubscription),
          useValue: mockSubscriptionRepo,
        },
        {
          provide: getRepositoryToken(Billing),
          useValue: mockBillingRepo,
        },
        {
          provide: getRepositoryToken(BillingLineItem),
          useValue: mockLineItemRepo,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepo,
        },
        {
          provide: SubscriptionService,
          useValue: mockSubscriptionService,
        },
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: RedisLockService,
          useValue: mockRedisLock,
        },
      ],
    }).compile();

    task = module.get<SubscriptionRenewalTask>(SubscriptionRenewalTask);
    subscriptionRepo = module.get<Repository<PatientSubscription>>(
      getRepositoryToken(PatientSubscription),
    );
    subscriptionService = module.get<SubscriptionService>(SubscriptionService);
    redisLock = module.get<RedisLockService>(RedisLockService);

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processRenewals', () => {
    it('should process subscriptions due for renewal successfully', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          patientId: 'patient-1',
          autoRenew: true,
          status: SubscriptionStatus.ACTIVE,
          currentPrice: 29.99,
          plan: { name: 'Basic Plan' },
        },
      ];

      mockRedisLock.acquireLock.mockResolvedValue(true);
      mockSubscriptionService.getSubscriptionsDueForRenewal.mockResolvedValue(mockSubscriptions);
      mockQueryRunner.manager.query.mockResolvedValue({ seq: 1 });
      mockQueryRunner.manager.create.mockImplementation((entity, data) => ({ ...data, id: 'test-id' }));
      mockQueryRunner.manager.save.mockResolvedValue({ id: 'test-id' });

      await task.processRenewals();

      expect(mockRedisLock.acquireLock).toHaveBeenCalledWith('lock:subscription-renewal', 300000);
      expect(mockSubscriptionService.getSubscriptionsDueForRenewal).toHaveBeenCalled();
      expect(mockRedisLock.releaseLock).toHaveBeenCalled();
    });

    it('should skip if lock cannot be acquired', async () => {
      mockRedisLock.acquireLock.mockResolvedValue(false);

      await task.processRenewals();

      expect(mockSubscriptionService.getSubscriptionsDueForRenewal).not.toHaveBeenCalled();
      expect(mockRedisLock.releaseLock).not.toHaveBeenCalled();
    });

    it('should handle non-renewing subscriptions', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          patientId: 'patient-1',
          autoRenew: false,
          status: SubscriptionStatus.ACTIVE,
        },
      ];

      mockRedisLock.acquireLock.mockResolvedValue(true);
      mockSubscriptionService.getSubscriptionsDueForRenewal.mockResolvedValue(mockSubscriptions);
      mockSubscriptionRepo.save.mockResolvedValue({});

      await task.processRenewals();

      expect(mockSubscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SubscriptionStatus.CANCELLED,
          cancellationReason: 'Auto-renew disabled',
        }),
      );
    });

    it('should skip inactive subscriptions', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          patientId: 'patient-1',
          autoRenew: true,
          status: SubscriptionStatus.SUSPENDED,
        },
      ];

      mockRedisLock.acquireLock.mockResolvedValue(true);
      mockSubscriptionService.getSubscriptionsDueForRenewal.mockResolvedValue(mockSubscriptions);

      await task.processRenewals();

      expect(mockQueryRunner.connect).not.toHaveBeenCalled();
    });
  });

  describe('handleFailedPayment', () => {
    it('should increment failed payment count and mark as past due', async () => {
      const subscription = {
        id: 'sub-1',
        consecutiveFailedPayments: 1,
        maxFailedPaymentsBeforeSuspension: 3,
      };

      const updatedSubscription = {
        ...subscription,
        consecutiveFailedPayments: 2,
        status: SubscriptionStatus.PAST_DUE,
      };

      mockSubscriptionService.incrementFailedPaymentCount.mockResolvedValue(updatedSubscription);

      await task['handleFailedPayment'](subscription, {} as Payment);

      expect(mockSubscriptionService.incrementFailedPaymentCount).toHaveBeenCalledWith('sub-1');
    });

    it('should suspend subscription when threshold is reached', async () => {
      const subscription = {
        id: 'sub-1',
        consecutiveFailedPayments: 2,
        maxFailedPaymentsBeforeSuspension: 3,
      };

      const suspendedSubscription = {
        ...subscription,
        consecutiveFailedPayments: 3,
        status: SubscriptionStatus.SUSPENDED,
      };

      mockSubscriptionService.incrementFailedPaymentCount.mockResolvedValue(suspendedSubscription);

      await task['handleFailedPayment'](subscription, {} as Payment);

      expect(mockSubscriptionService.incrementFailedPaymentCount).toHaveBeenCalledWith('sub-1');
    });
  });
});
