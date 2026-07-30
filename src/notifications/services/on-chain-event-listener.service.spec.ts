import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OnChainEventListenerService, OnChainEvent } from './on-chain-event-listener.service';
import { NotificationOutboxService } from './notification-outbox.service';
import { NotificationEventType } from '../interfaces/notification-event.interface';

jest.useFakeTimers();

const mockGauge = { set: jest.fn() };
const mockCounter = { inc: jest.fn() };

function buildRedis() {
  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };
}

async function createService() {
  const outboxService = { enqueue: jest.fn().mockResolvedValue(undefined) };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      OnChainEventListenerService,
      {
        provide: NotificationOutboxService,
        useValue: outboxService,
      },
      { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      { provide: 'PROM_METRIC_NOTIFICATIONS_EVENT_LISTENER_UP', useValue: mockGauge },
      { provide: 'PROM_METRIC_NOTIFICATIONS_MISSED_EVENTS_TOTAL', useValue: mockCounter },
    ],
  }).compile();

  const service = module.get<OnChainEventListenerService>(OnChainEventListenerService);

  // Stub Redis and _openConnection so no real I/O happens
  (service as any).redis = buildRedis();
  jest.spyOn(service as any, '_openConnection').mockResolvedValue(undefined);

  return { service, module, outboxService };
}

describe('OnChainEventListenerService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('handleOnChainEvent', () => {
    it('enqueues new_record → RECORD_UPLOADED to the outbox with a stable dedupe key', async () => {
      const { service, outboxService } = await createService();
      const event: OnChainEvent = {
        type: 'new_record',
        patientId: 'p1',
        actorId: 'sys',
        resourceId: 'r1',
        txHash: 'tx1',
      };

      await service.handleOnChainEvent(event);

      expect(outboxService.enqueue).toHaveBeenCalledWith(
        'tx1:new_record',
        expect.objectContaining({
          eventType: NotificationEventType.RECORD_UPLOADED,
          actorId: 'sys',
          resourceId: 'r1',
          metadata: expect.objectContaining({ txHash: 'tx1' }),
        }),
        'p1',
      );
    });

    it('enqueues access_grant → ACCESS_GRANTED to the outbox', async () => {
      const { service, outboxService } = await createService();
      await service.handleOnChainEvent({
        type: 'access_grant',
        patientId: 'p1',
        actorId: 'doc1',
        resourceId: 'r1',
        txHash: 'tx2',
      });

      expect(outboxService.enqueue).toHaveBeenCalledWith(
        'tx2:access_grant',
        expect.objectContaining({ eventType: NotificationEventType.ACCESS_GRANTED }),
        'p1',
      );
    });

    it('enqueues access_revoke → ACCESS_REVOKED to the outbox', async () => {
      const { service, outboxService } = await createService();
      await service.handleOnChainEvent({
        type: 'access_revoke',
        patientId: 'p1',
        actorId: 'doc1',
        resourceId: 'r1',
        txHash: 'tx3',
      });

      expect(outboxService.enqueue).toHaveBeenCalledWith(
        'tx3:access_revoke',
        expect.objectContaining({ eventType: NotificationEventType.ACCESS_REVOKED }),
        'p1',
      );
    });

    it('warns and skips unknown event types without enqueuing', async () => {
      const { service, outboxService } = await createService();
      await service.handleOnChainEvent({
        type: 'unknown' as any,
        patientId: 'p1',
        actorId: 'sys',
        resourceId: 'r1',
      });

      expect(outboxService.enqueue).not.toHaveBeenCalled();
    });

    it('uses ledgerSequence in dedupe key when txHash is absent', async () => {
      const { service, outboxService } = await createService();
      await service.handleOnChainEvent({
        type: 'new_record',
        patientId: 'p1',
        actorId: 'sys',
        resourceId: 'r1',
        ledgerSequence: 42,
      });

      const dedupeKey: string = outboxService.enqueue.mock.calls[0][0];
      expect(dedupeKey).toContain('42');
      expect(dedupeKey).toContain('new_record');
    });

    it('persists ledgerSequence to Redis when provided', async () => {
      const { service } = await createService();
      const redis = (service as any).redis;
      await service.handleOnChainEvent({
        type: 'new_record',
        patientId: 'p1',
        actorId: 'sys',
        resourceId: 'r1',
        ledgerSequence: 42,
      });

      expect(redis.set).toHaveBeenCalledWith(
        'notifications:last_processed_ledger',
        '42',
      );
    });
  });

  describe('reconnection logic', () => {
    it('schedules reconnect with exponential backoff on _scheduleReconnect()', () => {
      jest.spyOn(global, 'setTimeout');
      return createService().then(({ service }) => {
        service._scheduleReconnect();
        expect(setTimeout).toHaveBeenCalled();
        const [, delay] = (setTimeout as jest.Mock).mock.calls.at(-1)!;
        expect(delay).toBeGreaterThanOrEqual(800);  // 1000 * (1 - 0.2)
        expect(delay).toBeLessThanOrEqual(1200);    // 1000 * (1 + 0.2)
      });
    });

    it('doubles the base delay on each retry', async () => {
      jest.spyOn(global, 'setTimeout');
      const { service } = await createService();

      service._scheduleReconnect(); // attempt 1 — base 1s
      service._scheduleReconnect(); // attempt 2 — base 2s
      service._scheduleReconnect(); // attempt 3 — base 4s

      const delays = (setTimeout as jest.Mock).mock.calls.map(([, d]) => d);
      expect(delays[1]).toBeGreaterThan(delays[0]);
      expect(delays[2]).toBeGreaterThan(delays[1]);
    });

    it('caps delay at 60 s', async () => {
      jest.spyOn(global, 'setTimeout');
      const { service } = await createService();
      (service as any).retryCount = 20; // force large exponent
      service._scheduleReconnect();
      const [, delay] = (setTimeout as jest.Mock).mock.calls.at(-1)!;
      expect(delay).toBeLessThanOrEqual(60_000 * 1.2); // max + max jitter
    });

    it('sets listenerUpGauge to 0 on first disconnect', async () => {
      const { service } = await createService();
      service._scheduleReconnect();
      expect(mockGauge.set).toHaveBeenCalledWith(0);
    });
  });

  describe('liveness probe', () => {
    it('isHealthy() returns true when connected', async () => {
      const { service } = await createService();
      (service as any).disconnectedAt = null;
      expect(service.isHealthy()).toBe(true);
    });

    it('isHealthy() returns true when disconnected < 2 min', async () => {
      const { service } = await createService();
      (service as any).disconnectedAt = Date.now() - 60_000;
      expect(service.isHealthy()).toBe(true);
    });

    it('isHealthy() returns false when disconnected >= 2 min', async () => {
      const { service } = await createService();
      (service as any).disconnectedAt = Date.now() - 2 * 60 * 1_000 - 1;
      expect(service.isHealthy()).toBe(false);
    });
  });
});
