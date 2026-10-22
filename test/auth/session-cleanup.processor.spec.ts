/**
 * test/auth/session-cleanup.processor.spec.ts
 *
 * Covers:
 *  1. Normal cleanup run — deletes only expired rows, logs correct metrics.
 *  2. Overlapping job — second worker is skipped when the lock is held.
 *  3. Server restart mid-cleanup — lock TTL expires, next run succeeds idempotently.
 *  4. Partial batch (last batch < BATCH_SIZE) — loop terminates correctly.
 *  5. Empty table — no queries issued after first empty find.
 *  6. Database error — lock is always released even on failure.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import {
  SessionCleanupProcessor,
  CleanupResult,
} from '../../src/auth/session-cleanup.processor';
import { Session } from '../../src/auth/entities/session.entity';
import { RedisLockService, LockHandle } from '../../src/auth/redis-lock.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(id = 'test-job-1'): Partial<Job> {
  return { id };
}

function makeSession(expiresAt: Date): Partial<Session> {
  return { id: Math.random().toString(36).slice(2), expiresAt };
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

/** Build a mock SessionRepository with controllable find/delete behaviour. */
function buildRepoMock(batches: Partial<Session>[][]) {
  let callCount = 0;
  return {
    find: jest.fn().mockImplementation(() => {
      const result = batches[callCount] ?? [];
      callCount++;
      return Promise.resolve(result);
    }),
    delete: jest.fn().mockResolvedValue({ affected: undefined as number | undefined }),
  };
}

/** Build a mock RedisLockService that grants or denies the lock. */
function buildLockMock(acquired: boolean): jest.Mocked<RedisLockService> {
  const handle: LockHandle = { release: jest.fn().mockResolvedValue(undefined) };
  return {
    acquire: jest.fn().mockResolvedValue(acquired ? handle : null),
  } as unknown as jest.Mocked<RedisLockService>;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SessionCleanupProcessor', () => {
  let processor: SessionCleanupProcessor;
  let repoMock: ReturnType<typeof buildRepoMock>;
  let lockMock: jest.Mocked<RedisLockService>;

  /**
   * Re-create the processor with fresh mocks before each test.
   * We inject specific mock implementations via overrideProvider.
   */
  async function buildProcessor(
    batches: Partial<Session>[][],
    lockAcquired = true,
  ): Promise<void> {
    repoMock = buildRepoMock(batches);
    lockMock = buildLockMock(lockAcquired);

    // Set affected count to match each batch by default
    repoMock.delete.mockImplementation((ids: string[]) =>
      Promise.resolve({ affected: Array.isArray(ids) ? ids.length : 0 }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionCleanupProcessor,
        {
          provide: getRepositoryToken(Session),
          useValue: repoMock,
        },
        {
          provide: RedisLockService,
          useValue: lockMock,
        },
      ],
    }).compile();

    processor = module.get<SessionCleanupProcessor>(SessionCleanupProcessor);
  }

  // -------------------------------------------------------------------------
  // 1. Normal run
  // -------------------------------------------------------------------------
  describe('normal cleanup run', () => {
    const now = new Date();
    const expiredSessions = [
      makeSession(new Date(now.getTime() - 10_000)),
      makeSession(new Date(now.getTime() - 20_000)),
      makeSession(new Date(now.getTime() - 30_000)),
    ];

    beforeEach(() => buildProcessor([expiredSessions, []]));

    it('acquires the distributed lock', async () => {
      await processor.process(makeJob() as Job);
      expect(lockMock.acquire).toHaveBeenCalledTimes(1);
    });

    it('returns correct sessionsDeleted and sessionsExamined counts', async () => {
      const result = await processor.process(makeJob() as Job) as CleanupResult;
      expect(result.sessionsDeleted).toBe(3);
      expect(result.sessionsExamined).toBe(3);
    });

    it('releases the lock after completion', async () => {
      await processor.process(makeJob() as Job);
      // The handle's release is called in the finally block
      const handle = await (lockMock.acquire as jest.Mock).mock.results[0].value;
      expect(handle.release).toHaveBeenCalledTimes(1);
    });

    it('includes durationMs and ranAt in result', async () => {
      const result = await processor.process(makeJob() as Job) as CleanupResult;
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.ranAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO string
    });
  });

  // -------------------------------------------------------------------------
  // 2. Overlapping job — lock not acquired
  // -------------------------------------------------------------------------
  describe('overlapping job (lock contention)', () => {
    beforeEach(() => buildProcessor([[]], false /* lock denied */));

    it('returns a zero result without touching the database', async () => {
      const result = await processor.process(makeJob() as Job) as CleanupResult;
      expect(result.sessionsDeleted).toBe(0);
      expect(result.sessionsExamined).toBe(0);
      expect(repoMock.find).not.toHaveBeenCalled();
      expect(repoMock.delete).not.toHaveBeenCalled();
    });

    it('does not throw — job is marked successful', async () => {
      await expect(processor.process(makeJob() as Job)).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Server restart mid-cleanup (idempotency)
  // -------------------------------------------------------------------------
  describe('server restart mid-cleanup', () => {
    /**
     * Simulate: previous run was interrupted after deleting 2 of 5 sessions.
     * The lock TTL expired, so the next run acquires the lock and re-scans.
     * The remaining 3 expired sessions must be deleted; the already-deleted
     * ones are simply absent from the query results.
     */
    const remaining = [
      makeSession(new Date(Date.now() - 1_000)),
      makeSession(new Date(Date.now() - 2_000)),
      makeSession(new Date(Date.now() - 3_000)),
    ];

    beforeEach(() => buildProcessor([remaining, []]));

    it('processes remaining expired sessions without error', async () => {
      const result = await processor.process(makeJob() as Job) as CleanupResult;
      expect(result.sessionsDeleted).toBe(3);
    });

    it('is idempotent — re-running produces 0 deletes when table is clean', async () => {
      // First run cleans up the remaining sessions.
      await processor.process(makeJob() as Job);

      // Re-build with an empty table to simulate a second pass.
      await buildProcessor([[]], true);
      const result2 = await processor.process(makeJob('job-2') as Job) as CleanupResult;
      expect(result2.sessionsDeleted).toBe(0);
      expect(repoMock.delete).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Multi-batch cleanup
  // -------------------------------------------------------------------------
  describe('multi-batch cleanup (> BATCH_SIZE rows)', () => {
    const BATCH_SIZE = 500;
    const firstBatch  = Array.from({ length: BATCH_SIZE }, () =>
      makeSession(new Date(Date.now() - 1_000)),
    );
    const secondBatch = Array.from({ length: 200 }, () =>
      makeSession(new Date(Date.now() - 1_000)),
    );

    beforeEach(() => buildProcessor([firstBatch, secondBatch, []]));

    it('issues two delete calls', async () => {
      await processor.process(makeJob() as Job);
      expect(repoMock.delete).toHaveBeenCalledTimes(2);
    });

    it('sums totals across batches', async () => {
      const result = await processor.process(makeJob() as Job) as CleanupResult;
      expect(result.sessionsDeleted).toBe(BATCH_SIZE + 200);
      expect(result.sessionsExamined).toBe(BATCH_SIZE + 200);
      expect(result.batches).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Empty table
  // -------------------------------------------------------------------------
  describe('empty sessions table', () => {
    beforeEach(() => buildProcessor([[]]));

    it('makes no delete calls', async () => {
      await processor.process(makeJob() as Job);
      expect(repoMock.delete).not.toHaveBeenCalled();
    });

    it('returns zero counts', async () => {
      const result = await processor.process(makeJob() as Job) as CleanupResult;
      expect(result.sessionsDeleted).toBe(0);
      expect(result.sessionsExamined).toBe(0);
      expect(result.batches).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Database error — lock must be released
  // -------------------------------------------------------------------------
  describe('database error during cleanup', () => {
    beforeEach(async () => {
      repoMock = buildRepoMock([]);
      lockMock = buildLockMock(true);

      // Make find() throw on the first call.
      repoMock.find.mockRejectedValueOnce(new Error('DB connection lost'));

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SessionCleanupProcessor,
          { provide: getRepositoryToken(Session), useValue: repoMock },
          { provide: RedisLockService, useValue: lockMock },
        ],
      }).compile();

      processor = module.get<SessionCleanupProcessor>(SessionCleanupProcessor);
    });

    it('re-throws the error so BullMQ can record the failure', async () => {
      await expect(processor.process(makeJob() as Job)).rejects.toThrow(
        'DB connection lost',
      );
    });

    it('releases the distributed lock even on failure', async () => {
      try {
        await processor.process(makeJob() as Job);
      } catch {
        // expected
      }
      const handle = await (lockMock.acquire as jest.Mock).mock.results[0].value;
      expect(handle.release).toHaveBeenCalledTimes(1);
    });
  });
});