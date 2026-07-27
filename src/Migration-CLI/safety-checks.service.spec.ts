import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { SafetyChecksService, SafetyBlocker } from './safety-checks.service';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockDataSource = {
  query: jest.fn(),
};

// Mock BullMQ Queue before importing service
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    getWaiting: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getDelayed: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeService(): SafetyChecksService {
  // Directly construct to avoid NestJS bootstrap overhead in unit tests
  const service = new SafetyChecksService(mockDataSource as any);
  return service;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SafetyChecksService', () => {
  let service: SafetyChecksService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset NODE_ENV
    delete process.env.NODE_ENV;
    delete process.env.CONFIRM_PRODUCTION_MIGRATION;
    service = makeService();
  });

  // ── Production Guard ────────────────────────────────────────────────────

  describe('checkProductionGuard()', () => {
    it('passes when not in production', () => {
      process.env.NODE_ENV = 'development';
      const result = service.checkProductionGuard();
      expect(result.passed).toBe(true);
      expect(result.blocker).toBeUndefined();
    });

    it('blocks when in production without confirmation flag', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.CONFIRM_PRODUCTION_MIGRATION;

      const result = service.checkProductionGuard();

      expect(result.passed).toBe(false);
      expect(result.blocker).toBeDefined();
      expect(result.blocker!.type).toBe('production_guard');
      expect(result.blocker!.message).toContain('CONFIRM_PRODUCTION_MIGRATION=true');
    });

    it('passes when in production with CONFIRM_PRODUCTION_MIGRATION=true', () => {
      process.env.NODE_ENV = 'production';
      process.env.CONFIRM_PRODUCTION_MIGRATION = 'true';

      const result = service.checkProductionGuard();

      expect(result.passed).toBe(true);
      expect(result.blocker).toBeUndefined();
      expect(result.warning).toContain('CONFIRM_PRODUCTION_MIGRATION=true');
    });

    it('blocks when CONFIRM_PRODUCTION_MIGRATION is not exactly "true"', () => {
      process.env.NODE_ENV = 'production';
      process.env.CONFIRM_PRODUCTION_MIGRATION = 'yes'; // wrong value

      const result = service.checkProductionGuard();

      expect(result.passed).toBe(false);
    });
  });

  // ── Active Transactions ─────────────────────────────────────────────────

  describe('checkActiveTransactions()', () => {
    it('passes when no long-running transactions exist', async () => {
      mockDataSource.query.mockResolvedValueOnce([]); // no rows

      const result = await service.checkActiveTransactions();

      expect(result.blockers).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('blocks when active transactions older than 30s are found', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        {
          pid: '1234',
          query: 'SELECT * FROM users WHERE id = $1',
          state: 'active',
          duration_seconds: '45.32',
        },
        {
          pid: '5678',
          query: 'UPDATE wallets SET balance = $1',
          state: 'idle in transaction',
          duration_seconds: '31.10',
        },
      ]);

      const result = await service.checkActiveTransactions();

      expect(result.blockers).toHaveLength(1);
      const blocker = result.blockers[0];
      expect(blocker.type).toBe('active_transaction');
      expect(blocker.message).toContain('2 active transaction(s)');
      expect(blocker.detail).toMatchObject({
        transactionCount: 2,
        longestPid: '1234',
        longestDurationSeconds: '45.32',
      });
    });

    it('adds a warning (not blocker) when pg_stat_activity query fails', async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error('permission denied'));

      const result = await service.checkActiveTransactions();

      expect(result.blockers).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('pg_stat_activity');
    });
  });

  // ── BullMQ Jobs ─────────────────────────────────────────────────────────

  describe('checkBullMQJobs()', () => {
    it('passes when queues are empty', async () => {
      // Default mock returns empty arrays
      const result = await service.checkBullMQJobs(
        ['default-queue'],
        ['users'],
      );
      expect(result.blockers).toHaveLength(0);
    });

    it('blocks when queue has jobs referencing an affected table', async () => {
      const { Queue } = jest.requireMock('bullmq') as { Queue: jest.Mock };
      Queue.mockImplementationOnce(() => ({
        getWaiting: jest.fn().mockResolvedValue([
          { data: { table: 'users', userId: 42 } },
        ]),
        getActive: jest.fn().mockResolvedValue([]),
        getDelayed: jest.fn().mockResolvedValue([]),
        close: jest.fn().mockResolvedValue(undefined),
      }));

      const result = await service.checkBullMQJobs(
        ['email-queue'],
        ['users'],
      );

      expect(result.blockers).toHaveLength(1);
      expect(result.blockers[0].type).toBe('bullmq');
      expect(result.blockers[0].message).toContain('"email-queue"');
      expect(result.blockers[0].message).toContain('"users"');
    });

    it('adds warning when queue cannot be inspected', async () => {
      const { Queue } = jest.requireMock('bullmq') as { Queue: jest.Mock };
      Queue.mockImplementationOnce(() => {
        throw new Error('ECONNREFUSED');
      });

      const result = await service.checkBullMQJobs(['broken-queue'], ['users']);

      expect(result.blockers).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('broken-queue');
    });
  });

  // ── runAll() ────────────────────────────────────────────────────────────

  describe('runAll()', () => {
    it('returns passed=true when all checks pass', async () => {
      process.env.NODE_ENV = 'development';
      mockDataSource.query.mockResolvedValueOnce([]); // no active transactions

      const result = await service.runAll(['users'], []);

      expect(result.passed).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });

    it('aggregates multiple blockers', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.CONFIRM_PRODUCTION_MIGRATION;

      mockDataSource.query.mockResolvedValueOnce([
        {
          pid: '999',
          query: 'LOCK TABLE users',
          state: 'active',
          duration_seconds: '120',
        },
      ]);

      const result = await service.runAll(['users'], []);

      expect(result.passed).toBe(false);
      const types = result.blockers.map((b: SafetyBlocker) => b.type);
      expect(types).toContain('production_guard');
      expect(types).toContain('active_transaction');
    });
  });
});
