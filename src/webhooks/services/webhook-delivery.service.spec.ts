import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookDelivery, WebhookDeliveryStatus } from '../entities/webhook-delivery.entity';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';
import { AuditLogService } from '../../common/services/audit-log.service';
import { QUEUE_NAMES, JOB_TYPES } from '../../queues/queue.constants';
import { DlqService } from '../../dlq/dlq.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const makeSubscription = (overrides: Partial<WebhookSubscription> = {}): WebhookSubscription =>
  ({
    id: 'sub-1',
    url: 'https://example.com/hook',
    secret: 'secret-key',
    isActive: true,
    events: ['record.created'],
    tenantId: 'tenant-1',
    maxRetries: 5,
    retryDelaySeconds: 2,
    consecutiveFailures: 0,
    metadata: { customHeaders: {} },
    ...overrides,
  }) as unknown as WebhookSubscription;

const makeDelivery = (overrides: Partial<WebhookDelivery> = {}): WebhookDelivery =>
  ({
    id: 'delivery-1',
    subscriptionId: 'sub-1',
    eventType: 'record.created',
    eventPayload: { id: 'rec-1' },
    status: WebhookDeliveryStatus.PENDING,
    attemptCount: 0,
    maxAttempts: 5,
    lastError: null,
    lastHttpStatus: null,
    nextRetryAt: null,
    attempts: [],
    subscription: makeSubscription(),
    ...overrides,
  }) as unknown as WebhookDelivery;

const makeJob = (data: any, attemptsMade = 0): Job =>
  ({ data, attemptsMade, id: 'job-1' }) as unknown as Job;

describe('WebhookDeliveryService', () => {
  let service: WebhookDeliveryService;
  let deliveryRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; find: jest.Mock };
  let subscriptionRepo: { find: jest.Mock; save: jest.Mock };
  let webhookQueue: { add: jest.Mock };
  let auditService: { log: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let dlqService: { capture: jest.Mock };

  beforeEach(async () => {
    deliveryRepo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), find: jest.fn() };
    subscriptionRepo = { find: jest.fn(), save: jest.fn() };
    webhookQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    eventEmitter = { emit: jest.fn() };
    dlqService = { capture: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDeliveryService,
        { provide: getRepositoryToken(WebhookDelivery), useValue: deliveryRepo },
        { provide: getRepositoryToken(WebhookSubscription), useValue: subscriptionRepo },
        { provide: 'QUEUE_WEBHOOK_DELIVERY', useValue: webhookQueue },
        { provide: AuditLogService, useValue: auditService },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(5) } },
        { provide: DlqService, useValue: dlqService },
      ],
    }).compile();

    service = module.get(WebhookDeliveryService);
  });

  describe('deliverWebhook — receiver returns 500', () => {
    it('schedules a retry (throws) and records nextRetryAt when receiver responds 500', async () => {
      const delivery = makeDelivery({ maxAttempts: 5, attemptCount: 0 });
      deliveryRepo.findOne.mockResolvedValue(delivery);
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d));
      subscriptionRepo.save.mockResolvedValue(delivery.subscription);

      // Simulate the HTTP 500 response coming back as a rejection (validateStatus throws for 5xx)
      const axiosError = Object.assign(new Error('HTTP 500'), {
        isAxiosError: true,
        response: { status: 500, statusText: 'Internal Server Error', data: {} },
      });
      mockedAxios.post.mockRejectedValue(axiosError);

      // Should throw so BullMQ schedules a retry
      await expect(service.deliverWebhook(makeJob(
        {
          deliveryId: 'delivery-1',
          subscriptionId: 'sub-1',
          subscriptionUrl: 'https://example.com/hook',
          eventType: 'record.created',
          eventPayload: { id: 'rec-1' },
          subscriptionSecret: 'secret-key',
          tenantId: 'tenant-1',
        },
        0, // attemptsMade = 0, so attemptNumber = 1, maxAttempts = 5 → NOT exhausted
      ))).rejects.toThrow();

      // Delivery should have been saved with nextRetryAt set (retry scheduled)
      const savedDelivery = deliveryRepo.save.mock.calls.find(
        (call) => call[0].nextRetryAt !== undefined && call[0].nextRetryAt !== null,
      );
      expect(savedDelivery).toBeDefined();

      // Should NOT be moved to DEADLETTER yet (only attempt 1 of 5)
      const dlqSave = deliveryRepo.save.mock.calls.find(
        (call) => call[0].status === WebhookDeliveryStatus.DEADLETTER,
      );
      expect(dlqSave).toBeUndefined();
    });

    it('schedules an exponential backoff and stores a response snippet for failed attempts', async () => {
      const delivery = makeDelivery({ maxAttempts: 5, attemptCount: 0 });
      deliveryRepo.findOne.mockResolvedValue(delivery);
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d));
      subscriptionRepo.save.mockResolvedValue(delivery.subscription);

      const axiosError = Object.assign(new Error('HTTP 503'), {
        isAxiosError: true,
        response: { status: 503, statusText: 'Service Unavailable', data: { detail: 'down' } },
      });
      mockedAxios.post.mockRejectedValue(axiosError);

      await expect(service.deliverWebhook(makeJob(
        {
          deliveryId: 'delivery-1',
          subscriptionId: 'sub-1',
          subscriptionUrl: 'https://example.com/hook',
          eventType: 'record.created',
          eventPayload: { id: 'rec-1' },
          subscriptionSecret: 'secret-key',
          tenantId: 'tenant-1',
        },
        0,
      ))).rejects.toThrow();

      const savedDelivery = deliveryRepo.save.mock.calls.at(-1)?.[0];
      expect(savedDelivery.nextRetryAt).toBeInstanceOf(Date);
      expect(savedDelivery.nextRetryAt.getTime()).toBeGreaterThan(Date.now());
      expect(savedDelivery.attempts[0]).toEqual(expect.objectContaining({
        attemptNumber: 1,
        httpStatus: 503,
        responseBodySnippet: '{"detail":"down"}',
      }));
    });

    it('moves delivery to DEADLETTER after maxAttempts exhausted', async () => {
      const delivery = makeDelivery({ maxAttempts: 5, attemptCount: 4 });
      deliveryRepo.findOne.mockResolvedValue(delivery);
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d));
      subscriptionRepo.save.mockResolvedValue(delivery.subscription);

      const axiosError = Object.assign(new Error('HTTP 500'), {
        isAxiosError: true,
        response: { status: 500, statusText: 'Internal Server Error', data: {} },
      });
      mockedAxios.post.mockRejectedValue(axiosError);

      await service.deliverWebhook(makeJob(
        {
          deliveryId: 'delivery-1',
          subscriptionId: 'sub-1',
          subscriptionUrl: 'https://example.com/hook',
          eventType: 'record.created',
          eventPayload: { id: 'rec-1' },
          subscriptionSecret: 'secret-key',
          tenantId: 'tenant-1',
        },
        4, // attemptsMade = 4 → attemptNumber = 5 = maxAttempts
      ));

      const dlqSave = deliveryRepo.save.mock.calls.find(
        (call) => call[0].status === WebhookDeliveryStatus.DEADLETTER,
      );
      expect(dlqSave).toBeDefined();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FAILED' }),
      );
      expect(dlqService.capture).toHaveBeenCalledWith(
        expect.objectContaining({ queueName: QUEUE_NAMES.WEBHOOK_DELIVERY }),
      );
    });
  });

  describe('replayDelivery', () => {
    it('resets delivery and re-queues with freshly computed signature (no stored secret)', async () => {
      const delivery = makeDelivery({ status: WebhookDeliveryStatus.DEADLETTER });
      deliveryRepo.findOne.mockResolvedValue(delivery);
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d));

      await service.replayDelivery('delivery-1', 'admin-user');

      expect(delivery.status).toBe(WebhookDeliveryStatus.PENDING);
      expect(delivery.attemptCount).toBe(0);
      expect(webhookQueue.add).toHaveBeenCalledWith(
        JOB_TYPES.WEBHOOK_DELIVER,
        expect.objectContaining({
          // secret comes from the subscription relation (re-fetched), not stored on delivery
          subscriptionSecret: delivery.subscription.secret,
          eventPayload: delivery.eventPayload,
        }),
        expect.any(Object),
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REPLAYED', userId: 'admin-user' }),
      );
    });

    it('throws when delivery is not in DEADLETTER status', async () => {
      const delivery = makeDelivery({ status: WebhookDeliveryStatus.DELIVERED });
      deliveryRepo.findOne.mockResolvedValue(delivery);

      await expect(service.replayDelivery('delivery-1', 'admin')).rejects.toThrow(
        /not in DLQ status/,
      );
    });
  });
});
