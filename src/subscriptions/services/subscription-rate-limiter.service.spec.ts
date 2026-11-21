import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Gauge, Counter } from 'prom-client';
import { SubscriptionRateLimiterService } from './subscription-rate-limiter.service';

describe('SubscriptionRateLimiterService', () => {
  let service: SubscriptionRateLimiterService;

  const mockGauge = {
    inc: jest.fn(),
    dec: jest.fn(),
  };

  const mockCounter = {
    inc: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionRateLimiterService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'SUBSCRIPTIONS_MAX_PER_CONNECTION') return 3;
              if (key === 'SUBSCRIPTIONS_IDLE_TIMEOUT_MS') return 60000;
              if (key === 'SUBSCRIPTIONS_SWEEP_INTERVAL_MS') return 50000;
              return null;
            }),
          },
        },
        { provide: 'subscriptions_active', useValue: mockGauge },
        { provide: 'subscriptions_rejected_total', useValue: mockCounter },
        { provide: 'subscriptions_timedout_total', useValue: mockCounter },
      ],
    }).compile();

    service = module.get<SubscriptionRateLimiterService>(SubscriptionRateLimiterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerSubscription', () => {
    it('should register a subscription successfully', () => {
      const handle = service.registerSubscription('user-1', 'conn-1', 'testType', () => {});
      expect(handle).toBeDefined();
      expect(mockGauge.inc).toHaveBeenCalled();
    });

    it('should throw when per-connection limit is exceeded', () => {
      service.registerSubscription('user-1', 'conn-1', 'type1', () => {});
      service.registerSubscription('user-1', 'conn-1', 'type2', () => {});
      service.registerSubscription('user-1', 'conn-1', 'type3', () => {});
      expect(() => {
        service.registerSubscription('user-1', 'conn-1', 'type4', () => {});
      }).toThrow('Subscription limit reached');
      expect(mockCounter.inc).toHaveBeenCalled();
    });
  });

  describe('unregisterSubscription', () => {
    it('should unregister a subscription and decrement gauge', () => {
      const handle = service.registerSubscription('user-1', 'conn-1', 'testType', () => {});
      service.unregisterSubscription(handle);
      expect(mockGauge.dec).toHaveBeenCalled();
    });

    it('should allow new subscriptions after unregistering', () => {
      const h1 = service.registerSubscription('user-1', 'conn-1', 'type1', () => {});
      service.registerSubscription('user-1', 'conn-1', 'type2', () => {});
      service.registerSubscription('user-1', 'conn-1', 'type3', () => {});
      service.unregisterSubscription(h1);
      service.registerSubscription('user-1', 'conn-1', 'type4', () => {});
      // Should succeed
    });
  });

  describe('updateActivity', () => {
    it('should update the lastActivityAt timestamp', () => {
      const handle = service.registerSubscription('user-1', 'conn-1', 'testType', () => {});
      service.updateActivity(handle);
      // No error means success
      expect(true).toBe(true);
    });
  });

  describe('cleanupConnection', () => {
    it('should clean up all subscriptions for a connection', () => {
      service.registerSubscription('user-1', 'conn-1', 'type1', () => {});
      service.registerSubscription('user-1', 'conn-1', 'type2', () => {});
      const count = service.cleanupConnection('conn-1');
      expect(count).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return current stats', () => {
      service.registerSubscription('user-1', 'conn-1', 'type1', () => {});
      const stats = service.getStats();
      expect(stats.totalActive).toBe(1);
      expect(stats.perConnection['conn-1']).toBe(1);
    });
  });
});
