import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Job } from 'bullmq';
import axios from 'axios';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { WebhookDelivery, WebhookDeliveryStatus } from './entities/webhook-delivery.entity';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { AuditLogService } from '../common/services/audit-log.service';
import { DlqService } from '../dlq/dlq.service';
import { WebhookSignatureMiddleware } from '../common/middleware/webhook-signature.middleware';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * These helpers mirror the reference snippets published in `docs/webhooks.md`.
 * Keeping them here means the published guide is exercised against the real
 * signer (`WebhookDeliveryService`) and the real verifier
 * (`WebhookSignatureMiddleware`) rather than against a copy of the algorithm.
 */

/** docs/webhooks.md §1.4 — Node.js outbound verifier. */
function verifyOutboundSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const [scheme, receivedHex] = signatureHeader.split('=');
  if (scheme !== 'sha256' || !receivedHex) return false;

  const expectedHex = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  const a = Buffer.from(receivedHex, 'hex');
  const b = Buffer.from(expectedHex, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** docs/webhooks.md §2.3 — Node.js inbound signer. */
function signInbound(
  rawBody: string,
  secret: string,
  timestamp = Date.now(),
  nonce = randomBytes(16).toString('hex'),
): string {
  const payload = `${timestamp}.${nonce}.${rawBody}`;
  const hmac = createHmac('sha256', secret).update(payload).digest('hex');
  return `${timestamp}.${nonce}.${hmac}`;
}

const SUBSCRIPTION_SECRET = 'whsec_docs_reference_secret';
const INBOUND_SECRET = 'inbound-docs-reference-secret';
const INBOUND_SECRET_ENV = 'STELLAR_WEBHOOK_SECRET';

const makeSubscription = (overrides: Partial<WebhookSubscription> = {}): WebhookSubscription =>
  ({
    id: 'sub-docs',
    url: 'https://integrator.example/hooks',
    secret: SUBSCRIPTION_SECRET,
    isActive: true,
    events: ['record.uploaded'],
    tenantId: 'tenant-docs',
    maxRetries: 5,
    retryDelaySeconds: 2,
    consecutiveFailures: 0,
    metadata: { customHeaders: { 'X-Integrator-Id': 'docs' } },
    ...overrides,
  }) as unknown as WebhookSubscription;

const makeDelivery = (overrides: Partial<WebhookDelivery> = {}): WebhookDelivery =>
  ({
    id: 'delivery-docs',
    subscriptionId: 'sub-docs',
    eventType: 'record.uploaded',
    eventPayload: { eventType: 'record.uploaded', resourceId: 'rec-1' },
    status: WebhookDeliveryStatus.PENDING,
    attemptCount: 0,
    maxAttempts: 5,
    attempts: [],
    subscription: makeSubscription(),
    ...overrides,
  }) as unknown as WebhookDelivery;

const makeJob = (data: Record<string, unknown>, attemptsMade = 0): Job =>
  ({ data, attemptsMade, id: 'job-docs' }) as unknown as Job;

describe('webhooks docs reference snippets (docs/webhooks.md)', () => {
  describe('outbound signature (§1.4)', () => {
    let service: WebhookDeliveryService;
    let deliveryRepo: { findOne: jest.Mock; save: jest.Mock };
    let subscriptionRepo: { save: jest.Mock };

    const eventPayload = { eventType: 'record.uploaded', resourceId: 'rec-1', version: 3 };

    beforeEach(async () => {
      deliveryRepo = { findOne: jest.fn(), save: jest.fn() };
      subscriptionRepo = { save: jest.fn() };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WebhookDeliveryService,
          { provide: getRepositoryToken(WebhookDelivery), useValue: deliveryRepo },
          { provide: getRepositoryToken(WebhookSubscription), useValue: subscriptionRepo },
          { provide: 'QUEUE_WEBHOOK_DELIVERY', useValue: { add: jest.fn() } },
          { provide: AuditLogService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          { provide: ConfigService, useValue: { get: jest.fn((_k, d) => d) } },
          { provide: DlqService, useValue: { capture: jest.fn() } },
        ],
      }).compile();

      service = module.get(WebhookDeliveryService);

      deliveryRepo.findOne.mockResolvedValue(makeDelivery({ eventPayload }));
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d));
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s));
      mockedAxios.post.mockResolvedValue({ status: 200, data: { ok: true } } as any);
    });

    it('signs with sha256=<hex> over the raw JSON body that the documented verifier accepts', async () => {
      await service.deliverWebhook(
        makeJob({
          deliveryId: 'delivery-docs',
          subscriptionId: 'sub-docs',
          subscriptionUrl: 'https://integrator.example/hooks',
          eventType: 'record.uploaded',
          eventPayload,
          subscriptionSecret: SUBSCRIPTION_SECRET,
          customHeaders: { 'X-Integrator-Id': 'docs' },
          tenantId: 'tenant-docs',
        }),
      );

      const [, sentBody, config] = mockedAxios.post.mock.calls[0] as any;
      const headers = config.headers as Record<string, string>;
      const rawBody = JSON.stringify(sentBody);

      expect(headers['X-Webhook-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
      expect(verifyOutboundSignature(rawBody, headers['X-Webhook-Signature'], SUBSCRIPTION_SECRET)).toBe(true);

      // The event/delivery headers documented in §1.3 are present.
      expect(headers['X-Webhook-Event']).toBe('record.uploaded');
      expect(headers['X-Webhook-Delivery']).toBe('delivery-docs');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('rejects a tampered body and a wrong secret, as an integrator must', async () => {
      await service.deliverWebhook(
        makeJob({
          deliveryId: 'delivery-docs',
          subscriptionId: 'sub-docs',
          subscriptionUrl: 'https://integrator.example/hooks',
          eventType: 'record.uploaded',
          eventPayload,
          subscriptionSecret: SUBSCRIPTION_SECRET,
        }),
      );

      const [, sentBody, config] = mockedAxios.post.mock.calls[0] as any;
      const signature = (config.headers as Record<string, string>)['X-Webhook-Signature'];
      const rawBody = JSON.stringify(sentBody);

      expect(verifyOutboundSignature(`${rawBody} `, signature, SUBSCRIPTION_SECRET)).toBe(false);
      expect(verifyOutboundSignature(rawBody, signature, 'wrong-secret')).toBe(false);
      expect(verifyOutboundSignature(rawBody, undefined, SUBSCRIPTION_SECRET)).toBe(false);
    });
  });

  describe('inbound signature (§2)', () => {
    let middleware: WebhookSignatureMiddleware;
    let redis: { set: jest.Mock; del: jest.Mock };

    const rawBody = JSON.stringify({ tx: 'abc', ledger: 12345 });

    const makeReq = (header: string | undefined, body = rawBody): any => ({
      headers: header !== undefined ? { 'x-webhook-signature': header } : {},
      rawBody: body,
    });

    beforeEach(() => {
      process.env[INBOUND_SECRET_ENV] = INBOUND_SECRET;
      redis = {
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
      };
      middleware = new WebhookSignatureMiddleware(INBOUND_SECRET_ENV, redis as any);
    });

    afterEach(() => {
      delete process.env[INBOUND_SECRET_ENV];
    });

    it('accepts a header produced by the documented Node signer', async () => {
      const header = signInbound(rawBody, INBOUND_SECRET);
      const next = jest.fn();

      await middleware.use(makeReq(header), {} as any, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('rejects a header whose body was tampered with after signing', async () => {
      const header = signInbound(rawBody, INBOUND_SECRET);
      const next = jest.fn();

      await expect(
        middleware.use(makeReq(header, '{"tx":"evil"}'), {} as any, next),
      ).rejects.toThrow('Invalid webhook signature');
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects a stale timestamp (older than the documented 5-minute window)', async () => {
      const stale = Date.now() - 6 * 60 * 1000;
      const header = signInbound(rawBody, INBOUND_SECRET, stale);
      const next = jest.fn();

      await expect(middleware.use(makeReq(header), {} as any, next)).rejects.toThrow(
        'Webhook signature expired',
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects a replayed nonce via the Redis SET NX check', async () => {
      const header = signInbound(rawBody, INBOUND_SECRET);
      redis.set.mockResolvedValueOnce('OK').mockResolvedValue(null);
      const next = jest.fn();

      await middleware.use(makeReq(header), {} as any, next);
      await expect(middleware.use(makeReq(header), {} as any, next)).rejects.toThrow(
        'Webhook replay detected',
      );
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
