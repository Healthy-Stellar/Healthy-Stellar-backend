import { Test, TestingModule } from '@nestjs/testing';
import { DetailedHealthIndicator } from './detailed.health';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { QUEUE_NAMES } from '../../queues/queue.constants';

const mockQueue = (waitingCount = 0) => ({ getWaitingCount: jest.fn().mockResolvedValue(waitingCount) });

const mockDataSource = {
  driver: { master: { totalCount: 5, idleCount: 3, waitingCount: 0 } },
};

const mockRedis = {
  connect: jest.fn().mockResolvedValue(undefined),
  info: jest.fn().mockResolvedValue('used_memory:10485760\r\nmaxmemory:104857600\r\n'),
  quit: jest.fn().mockResolvedValue(undefined),
};

jest.mock('ioredis', () => jest.fn().mockImplementation(() => mockRedis));

const mockConfigService = { get: jest.fn((key: string, def?: any) => def) };

const mockHttpService = {
  get: jest.fn(),
  post: jest.fn(),
};

async function buildModule() {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      DetailedHealthIndicator,
      { provide: getDataSourceToken(), useValue: mockDataSource },
      { provide: getQueueToken(QUEUE_NAMES.STELLAR_TRANSACTIONS), useValue: mockQueue() },
      { provide: getQueueToken(QUEUE_NAMES.IPFS_UPLOADS), useValue: mockQueue() },
      { provide: getQueueToken(QUEUE_NAMES.EMAIL_NOTIFICATIONS), useValue: mockQueue() },
      { provide: getQueueToken(QUEUE_NAMES.REPORTS), useValue: mockQueue() },
      { provide: ConfigService, useValue: mockConfigService },
      { provide: HttpService, useValue: mockHttpService },
    ],
  }).compile();

  return module.get(DetailedHealthIndicator);
}

describe('DetailedHealthIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHttpService.get.mockReturnValue(
      of({ data: { history_latest_ledger: 100, history_elder_ledger: 98, Version: '0.28.0' } }),
    );
    mockHttpService.post.mockReturnValue(of({ data: { Version: '0.14.0' } }));
  });

  it('returns ok when all checks pass', async () => {
    const indicator = await buildModule();
    const result = await indicator.getDetailedHealth();

    expect(result.status).toBe('ok');
    expect(result.checks.database.status).toBe('ok');
    expect(result.checks.redis.status).toBe('ok');
    expect(result.checks.queues.status).toBe('ok');
    expect(result.checks.stellar.status).toBe('ok');
    expect(result.checks.ipfs.status).toBe('ok');
  });

  it('returns degraded when a non-critical check fails', async () => {
    mockHttpService.post.mockReturnValue(throwError(() => new Error('IPFS unreachable')));
    const indicator = await buildModule();
    const result = await indicator.getDetailedHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.ipfs.status).toBe('degraded');
    expect(result.checks.database.status).toBe('ok');
  });

  it('returns down when DB check fails', async () => {
    const brokenDs = { driver: { master: { totalCount: 80, idleCount: 0, waitingCount: 10 } } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DetailedHealthIndicator,
        { provide: getDataSourceToken(), useValue: brokenDs },
        { provide: getQueueToken(QUEUE_NAMES.STELLAR_TRANSACTIONS), useValue: mockQueue() },
        { provide: getQueueToken(QUEUE_NAMES.IPFS_UPLOADS), useValue: mockQueue() },
        { provide: getQueueToken(QUEUE_NAMES.EMAIL_NOTIFICATIONS), useValue: mockQueue() },
        { provide: getQueueToken(QUEUE_NAMES.REPORTS), useValue: mockQueue() },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    const indicator = module.get(DetailedHealthIndicator);
    const result = await indicator.getDetailedHealth();

    expect(result.status).toBe('down');
    expect(result.checks.database.status).toBe('down');
  });

  it('returns degraded when queue depth exceeds threshold', async () => {
    const highQueue = mockQueue(1001);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DetailedHealthIndicator,
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: getQueueToken(QUEUE_NAMES.STELLAR_TRANSACTIONS), useValue: highQueue },
        { provide: getQueueToken(QUEUE_NAMES.IPFS_UPLOADS), useValue: mockQueue() },
        { provide: getQueueToken(QUEUE_NAMES.EMAIL_NOTIFICATIONS), useValue: mockQueue() },
        { provide: getQueueToken(QUEUE_NAMES.REPORTS), useValue: mockQueue() },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    const indicator = module.get(DetailedHealthIndicator);
    const result = await indicator.getDetailedHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.queues.status).toBe('degraded');
  });

  it('each check result has required shape', async () => {
    const indicator = await buildModule();
    const result = await indicator.getDetailedHealth();

    for (const check of Object.values(result.checks)) {
      expect(check).toHaveProperty('status');
      expect(check).toHaveProperty('value');
      expect(check).toHaveProperty('threshold');
      expect(check).toHaveProperty('message');
    }
  });
});
