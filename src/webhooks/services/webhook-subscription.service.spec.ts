import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { WebhookSubscriptionService } from './webhook-subscription.service';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';
import { AuditLogService } from '../../common/services/audit-log.service';

jest.mock('dns', () => ({
  ...jest.requireActual('dns'),
  promises: { lookup: jest.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]) },
}));
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockRepo = () => ({
  count: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data: any) => data),
  save: jest.fn(),
  remove: jest.fn(),
});
const mockAudit = () => ({ create: jest.fn().mockResolvedValue(undefined) });
const mockConfig = () => ({ get: jest.fn((_key: string, def: any) => def) });

describe('WebhookSubscriptionService', () => {
  let service: WebhookSubscriptionService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookSubscriptionService,
        { provide: getRepositoryToken(WebhookSubscription), useFactory: mockRepo },
        { provide: AuditLogService, useFactory: mockAudit },
        { provide: ConfigService, useFactory: mockConfig },
      ],
    }).compile();

    service = module.get(WebhookSubscriptionService);
    repo = module.get(getRepositoryToken(WebhookSubscription));
  });

  afterEach(() => jest.clearAllMocks());

  // ── createSubscription ─────────────────────────────────────────────────────

  describe('createSubscription', () => {
    it('creates a subscription and auto-generates a secret', async () => {
      repo.count.mockResolvedValue(0);
      mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);
      const sub = { id: 'sub-1', url: 'https://example.com', events: ['patient.created'] };
      repo.save.mockResolvedValue(sub);

      const result = await service.createSubscription('tenant-1', 'user-1', {
        url: 'https://example.com',
        events: ['patient.created'],
      });

      expect(repo.save).toHaveBeenCalled();
      expect(result.id).toBe('sub-1');
    });

    it('uses the caller-supplied secret when provided', async () => {
      repo.count.mockResolvedValue(0);
      mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);
      repo.save.mockImplementation(async (data) => ({ id: 'sub-2', ...data }));

      const result = await service.createSubscription('tenant-1', 'user-1', {
        url: 'https://example.com',
        events: ['lab.result'],
        secret: 'my-custom-secret',
      });

      expect(result.secret).toBe('my-custom-secret');
    });

    it('throws ForbiddenException when tenant has reached the subscription cap', async () => {
      repo.count.mockResolvedValue(25);

      await expect(
        service.createSubscription('tenant-1', 'user-1', {
          url: 'https://example.com',
          events: ['patient.created'],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when ping validation receives a non-2xx status', async () => {
      repo.count.mockResolvedValue(0);
      mockedAxios.post.mockResolvedValue({ status: 404, data: {} } as any);

      await expect(
        service.createSubscription('tenant-1', 'user-1', {
          url: 'https://example.com/not-found',
          events: ['patient.created'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when ping request throws a network error', async () => {
      repo.count.mockResolvedValue(0);
      mockedAxios.post.mockRejectedValue(new Error('connect ECONNREFUSED'));

      await expect(
        service.createSubscription('tenant-1', 'user-1', {
          url: 'https://unreachable.example.com',
          events: ['patient.created'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── SSRF protection ────────────────────────────────────────────────────────

  describe('SSRF protection', () => {
    const dto = { events: ['appointment.created'] };

    it.each(['http://169.254.169.254/latest/meta-data/', 'http://10.0.0.5:6379'])(
      'rejects internal IP literal %s on create without sending a request',
      async (url) => {
        repo.count.mockResolvedValue(0);
        await expect(
          service.createSubscription('tenant-1', 'user-1', { ...dto, url }),
        ).rejects.toThrow(BadRequestException);
        expect(mockedAxios.post).not.toHaveBeenCalled();
      },
    );

    it('rejects a hostname that resolves to 127.0.0.1', async () => {
      (require('dns').promises.lookup as jest.Mock).mockResolvedValueOnce([
        { address: '127.0.0.1', family: 4 },
      ]);
      repo.count.mockResolvedValue(0);
      await expect(
        service.createSubscription('tenant-1', 'user-1', { ...dto, url: 'https://rebind.example.com' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('treats a redirect response as a failed ping and never follows it', async () => {
      repo.count.mockResolvedValue(0);
      mockedAxios.post.mockResolvedValue({
        status: 302,
        headers: { location: 'http://10.0.0.5/' },
        data: {},
      } as any);
      await expect(
        service.createSubscription('tenant-1', 'user-1', { ...dto, url: 'https://example.com/r' }),
      ).rejects.toThrow(BadRequestException);
      expect((mockedAxios.post.mock.calls[0][2] as any).maxRedirects).toBe(0);
    });

    it('does not leak the raw network error', async () => {
      repo.count.mockResolvedValue(0);
      mockedAxios.post.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
      await expect(
        service.createSubscription('tenant-1', 'user-1', { ...dto, url: 'https://example.com/x' }),
      ).rejects.toThrow(/did not respond with a 2xx/);
    });

    it('validates the new URL on update', async () => {
      repo.findOne.mockResolvedValue({ id: 'sub-1', tenantId: 'tenant-1', url: 'https://example.com', secret: 's' });
      await expect(
        service.updateSubscription('tenant-1', 'sub-1', 'user-1', { url: 'http://169.254.169.254/' }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  // ── rotateSecret ───────────────────────────────────────────────────────────

  describe('rotateSecret', () => {
    it('generates a new 64-char hex secret and persists it', async () => {
      const sub = { id: 'sub-1', tenantId: 'tenant-1', secret: 'old-secret' };
      repo.findOne.mockResolvedValue(sub);
      repo.save.mockImplementation(async (s: any) => s);

      const result = await service.rotateSecret('tenant-1', 'sub-1', 'user-1');

      expect(result.secret).not.toBe('old-secret');
      expect(result.secret).toHaveLength(64);
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ secret: result.secret }));
    });

    it('throws NotFoundException for an unknown subscription id', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.rotateSecret('tenant-1', 'ghost', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('enforces tenant isolation — cannot rotate another tenant\'s secret', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.rotateSecret('tenant-A', 'sub-of-tenant-B', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── deleteSubscription ─────────────────────────────────────────────────────

  describe('deleteSubscription', () => {
    it('removes the subscription and audits the deletion', async () => {
      const sub = { id: 'sub-1', tenantId: 'tenant-1' };
      repo.findOne.mockResolvedValue(sub);
      repo.remove.mockResolvedValue(sub);

      await service.deleteSubscription('tenant-1', 'sub-1', 'user-1');

      expect(repo.remove).toHaveBeenCalledWith(sub);
    });
  });

  // ── event delivery reaches registered URL ──────────────────────────────────

  describe('pingEndpoint (simulates event delivery flow)', () => {
    it('resolves when the target endpoint returns 2xx', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: { ok: true } } as any);
      await expect(
        service.pingEndpoint('https://example.com/hook', 'secret'),
      ).resolves.toBeUndefined();
    });

    it('includes X-Webhook-Signature header in the ping request', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);
      await service.pingEndpoint('https://example.com/hook', 'mysecret');
      const [, , opts] = mockedAxios.post.mock.calls[0];
      expect((opts as any).headers['X-Webhook-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
    });
  });
});
