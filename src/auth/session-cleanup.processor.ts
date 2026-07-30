import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { RedisLockService } from './redis-lock.service';

/** ------------------------------------------------------------------
 *  Constants
 * ------------------------------------------------------------------ */
export const SESSION_CLEANUP_QUEUE = 'session-cleanup';
export const SESSION_CLEANUP_JOB  = 'delete-expired-sessions';

/**
 * A single stable jobId prevents BullMQ from enqueuing duplicates when
 * the scheduler fires on every instance in a multi-replica deployment.
 */
const CLEANUP_JOB_ID = 'session-cleanup:singleton';

/**
 * Distributed-lock key stored in Redis.
 * TTL is intentionally longer than the expected job duration so the lock
 * survives a slow database query, but short enough to recover from a crash.
 */
const LOCK_KEY = 'lock:session-cleanup';
const LOCK_TTL_MS = 5 * 60 * 1_000; // 5 minutes

/** How many expired rows to delete per batch (avoids long-lived transactions). */
const BATCH_SIZE = 500;

/** ------------------------------------------------------------------
 *  Queue scheduler / producer
 * ------------------------------------------------------------------ */
@Injectable()
export class SessionCleanupScheduler implements OnModuleInit {
  private readonly logger = new Logger(SessionCleanupScheduler.name);

  constructor(
    @InjectQueue(SESSION_CLEANUP_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    /**
     * Upsert a repeatable job.  Using `jobId` + `removeOnComplete` together
     * means:
     *   • Only one instance of this job ever sits in the queue at a time.
     *   • Completed jobs are removed immediately, so the queue stays clean.
     *
     * The repeat pattern uses a cron expression (every 15 minutes).
     * Adjust SESSION_CLEANUP_CRON via environment variable as needed.
     */
    const cron = process.env.SESSION_CLEANUP_CRON ?? '*/15 * * * *';

    await this.queue.add(
      SESSION_CLEANUP_JOB,
      {},
      {
        jobId: CLEANUP_JOB_ID,
        repeat: { pattern: cron },
        removeOnComplete: true,
        removeOnFail: 5, // retain the last 5 failures for inspection
      },
    );

    this.logger.log(
      `Session cleanup job scheduled — cron="${cron}" jobId="${CLEANUP_JOB_ID}"`,
    );
  }
}

/** ------------------------------------------------------------------
 *  Job result shape (stored in job.returnvalue for observability)
 * ------------------------------------------------------------------ */
export interface CleanupResult {
  sessionsExamined: number;
  sessionsDeleted: number;
  batches: number;
  durationMs: number;
  ranAt: string;
}

/** ------------------------------------------------------------------
 *  Worker / processor
 * ------------------------------------------------------------------ */
@Processor(SESSION_CLEANUP_QUEUE)
export class SessionCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(SessionCleanupProcessor.name);

  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    private readonly redisLock: RedisLockService,
  ) {
    super();
  }

  /** Entry point called by BullMQ for every dequeued job. */
  async process(job: Job): Promise<CleanupResult> {
    this.logger.log(`Job [${job.id}] started — attempting distributed lock…`);

    const lock = await this.redisLock.acquire(LOCK_KEY, LOCK_TTL_MS);

    if (!lock) {
      this.logger.warn(
        `Job [${job.id}] skipped — another worker already holds the cleanup lock.`,
      );
      // Return a zero-result so BullMQ marks the job as succeeded (not failed).
      return this.zeroResult();
    }

    const startMs = Date.now();
    let sessionsDeleted = 0;
    let sessionsExamined = 0;
    let batches = 0;

    try {
      const cutoff = new Date(); // "now" — everything with expiresAt < cutoff is stale

      /**
       * Batch deletion loop.
       *
       * Why batches?
       *   A single DELETE … WHERE expiresAt < now may lock many rows at once,
       *   causing contention with concurrent login/logout queries.  Batching
       *   keeps individual transactions small and predictable.
       */
      while (true) {
        // 1. Find the next batch of expired session IDs.
        const expired = await this.sessionRepo.find({
          select: ['id'],
          where: { expiresAt: LessThan(cutoff) },
          take: BATCH_SIZE,
          order: { expiresAt: 'ASC' },
        });

        if (expired.length === 0) break;

        sessionsExamined += expired.length;

        const ids = expired.map((s) => s.id);

        // 2. Delete this batch.
        const deleteResult = await this.sessionRepo.delete(ids);
        const deleted = deleteResult.affected ?? 0;
        sessionsDeleted += deleted;
        batches++;

        this.logger.debug(
          `Batch ${batches}: examined=${expired.length} deleted=${deleted}`,
        );

        // 3. If this batch was smaller than the limit, we've emptied the table.
        if (expired.length < BATCH_SIZE) break;
      }

      const durationMs = Date.now() - startMs;
      const result: CleanupResult = {
        sessionsExamined,
        sessionsDeleted,
        batches,
        durationMs,
        ranAt: new Date().toISOString(),
      };

      this.logger.log(
        `Job [${job.id}] complete — ` +
          `deleted=${sessionsDeleted} examined=${sessionsExamined} ` +
          `batches=${batches} duration=${durationMs}ms`,
      );

      return result;
    } catch (err) {
      this.logger.error(`Job [${job.id}] failed: ${err}`);
      throw err; // Let BullMQ record the failure and retry according to its policy.
    } finally {
      await lock.release();
    }
  }

  private zeroResult(): CleanupResult {
    return {
      sessionsExamined: 0,
      sessionsDeleted: 0,
      batches: 0,
      durationMs: 0,
      ranAt: new Date().toISOString(),
    };
  }
}