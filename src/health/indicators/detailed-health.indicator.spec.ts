import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckError } from '@nestjs/terminus';
import { DetailedHealthIndicator } from './detailed-health.indicator';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../queues/queue.constants';
import { of, throwError } from 'rxjs';

const mockDataSource = {
  driver: {
    master: {
      _allConnections: [1, 2],
      _freeConnections: [1],
      _connectionQueue: [],
    },
  },
};

const mockStellarQueue = { getWaitingCount: jest.fn() };
const mockIpfsQueue = { getWaitingCount: jest.fn() };
const mockEmailQueue = { getWaitingCount: jest.fn() };

const mockConfigService = {
  get: jest.fn((key: string, fallback?: unknown) => {
    const map: Record<string, unknown> = {
      DB_POOL_MAX: 10,
      REDIS_MEMORY_THRESHOLD_MB: 512,
      QUEUE_DEPTH_THRESHOLD: 100,
      BLOCKCHAIN_LAG_THRESHOLD: 10,
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
      IPFS_API_URL: 'http://localhost:5001',
    };
    return map[key] ?? fallback;
  }),
};

const mockHttpService = { get: jest.fn(), post: jest.fn() };

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    info: jest.fn().mockResolvedValue('used_memory:104857600\r\n'), // 100 MB
    quit: jest.fn().mockResolvedValue(undefined),
  }));
});

describe('DetailedHealthIndicator', () => {
  let indicator: DetailedHealthIndicator;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DetailedHealthIndicator,
        { provide: DataSource, useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: getQueueToken(QUEUE_NAMES.STELLAR_TRANSACTIONS), useValue: mockStellarQueue },
        { provide: getQueueToken(QUEUE_NAMES.IPFS_UPLOADS), useValue: mockIpfsQueue },
        { provide: getQueueToken(QUEUE_NAMES.EMAIL_NOTIFICATIONS), useValue: mockEmailQueue },
      ],
    }).compile();

    indicator = module.get(DetailedHealthIndicator);
  });

  describe('checkDbPool', () => {
    it('returns up when pool is below threshold', async () => {
      const result = await indicator.checkDbPool();
      expect(result.status).toBe('up');
      expect((result.value as any).active).toBe(2);
      expect(result.threshold).toBe(10);
    });

    it('returns degraded when pool is at threshold', async () => {
      const saturated = {
        driver: { master: { _allConnections: new Array(10).fill(1), _freeConnections: [], _connectionQueue: [] } },
      };
      (indicator as any).dataSource = saturated;
      const result = await indicator.checkDbPool();
      expect(result.status).toBe('degraded');
    });

    it('returns down on exception', async () => {
      (indicator as any).dataSource = { driver: null };
      const result = await indicator.checkDbPool();
      expect(result.status).toBe('down');
    });
  });

  describe('checkRedisMemory', () => {
    it('returns up when memory is below threshold', async () => {
      const result = await indicator.checkRedisMemory();
      expect(result.status).toBe('up');
      expect(result.value).toBe('100MB');
    });

    it('returns degraded when Redis is unreachable', async () => {
      const Redis = require('ioredis');
      Redis.mockImplementationOnce(() => ({
        connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        quit: jest.fn(),
      }));
      const result = await indicator.checkRedisMemory();
      expect(result.status).toBe('degraded');
      expect(result.message).toContain('ECONNREFUSED');
    });
  });

  describe('checkQueueDepths', () => {
    it('returns up when all queues are below threshold', async () => {
      mockStellarQueue.getWaitingCount.mockResolvedValue(5);
      mockIpfsQueue.getWaitingCount.mockResolvedValue(3);
      mockEmailQueue.getWaitingCount.mockResolvedValue(10);

      const result = await indicator.checkQueueDepths();
      expect(result.status).toBe('up');
      expect((result.value as any)[QUEUE_NAMES.STELLAR_TRANSACTIONS]).toBe(5);
    });

    it('returns degraded when a queue exceeds threshold', async () => {
      mockStellarQueue.getWaitingCount.mockResolvedValue(150);
      mockIpfsQueue.getWaitingCount.mockResolvedValue(0);
      mockEmailQueue.getWaitingCount.mockResolvedValue(0);

      const result = await indicator.checkQueueDepths();
      expect(result.status).toBe('degraded');
      expect(result.message).toContain('150');
    });

    it('returns degraded on queue error', async () => {
      mockStellarQueue.getWaitingCount.mockRejectedValue(new Error('Redis down'));
      const result = await indicator.checkQueueDepths();
      expect(result.status).toBe('degraded');
    });
  });

  describe('checkBlockchainLag', () => {
    it('returns up when lag is below threshold', async () => {
      mockHttpService.get.mockReturnValue(
        of({ data: { core_latest_ledger: 1000, history_latest_ledger: 998 } }),
      );
      const result = await indicator.checkBlockchainLag();
      expect(result.status).toBe('up');
      expect((result.value as any).lag).toBe(2);
    });

    it('returns degraded when lag exceeds threshold', async () => {
      mockHttpService.get.mockReturnValue(
        of({ data: { core_latest_ledger: 1000, history_latest_ledger: 985 } }),
      );
      const result = await indicator.checkBlockchainLag();
      expect(result.status).toBe('degraded');
      expect(result.message).toContain('15 ledgers');
    });

    it('returns degraded when Horizon is unreachable', async () => {
      mockHttpService.get.mockReturnValue(throwError(() => new Error('timeout')));
      const result = await indicator.checkBlockchainLag();
      expect(result.status).toBe('degraded');
    });
  });

  describe('checkIpfsConnectivity', () => {
    it('returns up when IPFS is reachable', async () => {
      mockHttpService.post.mockReturnValue(of({ data: { Version: '0.18.0' } }));
      const result = await indicator.checkIpfsConnectivity();
      expect(result.status).toBe('up');
      expect((result.value as any).version).toBe('0.18.0');
    });

    it('returns degraded when IPFS is unreachable', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
      const result = await indicator.checkIpfsConnectivity();
      expect(result.status).toBe('degraded');
    });
  });

  describe('getDetailedHealth', () => {
    beforeEach(() => {
      mockStellarQueue.getWaitingCount.mockResolvedValue(0);
      mockIpfsQueue.getWaitingCount.mockResolvedValue(0);
      mockEmailQueue.getWaitingCount.mockResolvedValue(0);
      mockHttpService.get.mockReturnValue(
        of({ data: { core_latest_ledger: 100, history_latest_ledger: 100 } }),
      );
      mockHttpService.post.mockReturnValue(of({ data: { Version: '0.18.0' } }));
    });

    it('returns overall up when all checks pass', async () => {
      const result = await indicator.getDetailedHealth();
      expect(result.detailed.status).toBe('up');
      expect(result.detailed.details.overallStatus).toBe('up');
    });

    it('returns overall degraded when a non-critical check fails', async () => {
      mockHttpService.post.mockReturnValue(throwError(() => new Error('IPFS down')));
      const result = await indicator.getDetailedHealth();
      expect(result.detailed.details.overallStatus).toBe('degraded');
    });

    it('throws HealthCheckError with down status when DB is critical failure', async () => {
      (indicator as any).dataSource = { driver: null };
      // Force checkDbPool to return 'down'
      jest.spyOn(indicator, 'checkDbPool').mockResolvedValue({
        status: 'down',
        value: null,
        threshold: null,
        message: 'DB pool failed',
      });

      await expect(indicator.getDetailedHealth()).rejects.toThrow(HealthCheckError);
    });
  });
});
