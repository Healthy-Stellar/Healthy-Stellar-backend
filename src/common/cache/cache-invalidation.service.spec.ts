import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheInvalidationService } from './cache-invalidation.service';
import { CacheInvalidationEventType } from './cache-invalidation.enum';

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInvalidationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CacheInvalidationService>(CacheInvalidationService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('Cache invalidation propagation', () => {
    it('should deliver cache invalidation event to subscribers within 1 second', async (done) => {
      // Arrange
      const tenantId = '00000000-0000-0000-0000-000000000001';
      const key = 'test-config-key';
      let receivedEvent: any = null;
      const startTime = Date.now();

      // Setup subscriber
      const unsubscribe = service.subscribe((event) => {
        receivedEvent = event;
      });

      // Wait for subscription to be established
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Act - publish invalidation event
      await service.publishInvalidation(
        CacheInvalidationEventType.TENANT_CONFIG_UPDATED,
        tenantId,
        key,
      );

      // Wait for event to be received
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (receivedEvent) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 50);
        // Timeout after 2 seconds
        setTimeout(() => clearInterval(checkInterval), 2000);
      });

      // Assert
      const elapsedTime = Date.now() - startTime;
      expect(receivedEvent).toBeDefined();
      expect(receivedEvent.type).toBe(CacheInvalidationEventType.TENANT_CONFIG_UPDATED);
      expect(receivedEvent.tenantId).toBe(tenantId);
      expect(receivedEvent.key).toBe(key);
      expect(elapsedTime).toBeLessThan(1000);

      unsubscribe();
      done();
    });

    it('should support multiple subscribers receiving same event', async (done) => {
      // Arrange
      const tenantId = '00000000-0000-0000-0000-000000000002';
      const key = 'multi-subscriber-test';
      let receivedEvents: any[] = [];

      // Setup multiple subscribers
      const unsubscribe1 = service.subscribe((event) => {
        receivedEvents.push({ subscriber: 1, event });
      });
      const unsubscribe2 = service.subscribe((event) => {
        receivedEvents.push({ subscriber: 2, event });
      });

      // Wait for subscriptions to be established
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Act
      await service.publishInvalidation(
        CacheInvalidationEventType.FEATURE_FLAG_UPDATED,
        tenantId,
        key,
      );

      // Wait for events to be received
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (receivedEvents.length >= 2) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 50);
        setTimeout(() => clearInterval(checkInterval), 2000);
      });

      // Assert - both subscribers should receive the event
      expect(receivedEvents.length).toBeGreaterThanOrEqual(2);
      receivedEvents.forEach(({ subscriber, event }) => {
        expect(event.type).toBe(CacheInvalidationEventType.FEATURE_FLAG_UPDATED);
        expect(event.tenantId).toBe(tenantId);
        expect(event.key).toBe(key);
      });

      unsubscribe1();
      unsubscribe2();
      done();
    });

    it('should handle different event types', async (done) => {
      // Arrange
      const eventTypes = [
        CacheInvalidationEventType.TENANT_CONFIG_UPDATED,
        CacheInvalidationEventType.TENANT_CONFIG_DELETED,
        CacheInvalidationEventType.FEATURE_FLAG_UPDATED,
        CacheInvalidationEventType.RBAC_PERMISSION_UPDATED,
      ];
      let receivedEvents: any[] = [];

      const unsubscribe = service.subscribe((event) => {
        receivedEvents.push(event);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Act
      for (const eventType of eventTypes) {
        await service.publishInvalidation(eventType, 'tenant-1', 'key-1');
      }

      // Wait for events
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (receivedEvents.length >= eventTypes.length) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 50);
        setTimeout(() => clearInterval(checkInterval), 2000);
      });

      // Assert
      expect(receivedEvents.length).toBe(eventTypes.length);
      receivedEvents.forEach((event, index) => {
        expect(event.type).toBe(eventTypes[index]);
      });

      unsubscribe();
      done();
    });
  });
});
