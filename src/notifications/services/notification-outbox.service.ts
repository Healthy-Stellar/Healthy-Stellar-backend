import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, In, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  NotificationOutboxEntry,
  OutboxStatus,
} from '../entities/notification-outbox.entity';
import { NotificationsService } from './notifications.service';
import {
  NotificationEvent,
  NotificationEventType,
} from '../interfaces/notification-event.interface';

/** Maximum number of outbox entries processed per sweep. */
const BATCH_SIZE = 50;

/** Base delay (ms) for exponential back-off: delay = BASE_DELAY_MS * 2^(attempts-1) */
const BASE_DELAY_MS = 30_000; // 30 s

/**
 * Implements the transactional outbox pattern for notification delivery.
 *
 * Responsibilities:
 *  - Persist every notification side-effect to `notification_outbox` before
 *    attempting delivery (at-least-once guarantee).
 *  - Sweep PENDING entries on a schedule and retry FAILED entries whose
 *    `next_attempt_at` has elapsed, using exponential back-off.
 *  - Mark entries COMPLETED once {@link NotificationsService.notifyOnChainEvent}
 *    succeeds.
 */
@Injectable()
export class NotificationOutboxService implements OnModuleInit {
  private readonly logger = new Logger(NotificationOutboxService.name);

  /** Guard against concurrent sweeps (e.g. slow DB + fast cron). */
  private sweepRunning = false;

  constructor(
    @InjectRepository(NotificationOutboxEntry)
    private readonly outboxRepo: Repository<NotificationOutboxEntry>,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    // Run an initial sweep shortly after startup so any entries left in
    // PENDING/FAILED state from a previous process are picked up quickly.
    setTimeout(() => void this.sweep(), 5_000);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Persist a notification event to the outbox and attempt immediate delivery.
   *
   * Uses a unique `dedupeKey` to prevent duplicate entries — safe to call
   * multiple times with the same key (idempotent).
   *
   * @param dedupeKey  Stable identifier for this event (e.g. `txHash:eventType`)
   * @param event      The notification event payload
   * @param patientId  Target patient/user for delivery routing
   */
  async enqueue(
    dedupeKey: string,
    event: NotificationEvent,
    patientId: string,
  ): Promise<void> {
    // Check for existing entry first (idempotency).
    const existing = await this.outboxRepo.findOne({
      where: { dedupe_key: dedupeKey },
    });
    if (existing) {
      this.logger.debug(`Outbox entry already exists for key: ${dedupeKey}`);
      return;
    }

    const entry = this.outboxRepo.create({
      dedupe_key: dedupeKey,
      payload: event as unknown as Record<string, unknown>,
      patient_id: patientId,
      status: OutboxStatus.PENDING,
      attempts: 0,
      max_attempts: 5,
      next_attempt_at: null,
      last_error: null,
    });

    try {
      await this.outboxRepo.save(entry);
    } catch (err: unknown) {
      // Race condition: another process inserted the same key between our
      // findOne and save. This is safe to ignore.
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('UQ_notification_outbox_dedupe_key') ||
        msg.includes('unique')
      ) {
        this.logger.debug(
          `Outbox race condition on key ${dedupeKey} — entry already exists.`,
        );
        return;
      }
      throw err;
    }

    // Attempt immediate delivery; the cron sweep handles retries on failure.
    await this.processEntry(entry);
  }

  /**
   * Scheduled sweep — runs every minute.
   * Picks up PENDING entries and FAILED entries whose back-off window has elapsed.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    if (this.sweepRunning) {
      this.logger.debug('Outbox sweep already running, skipping.');
      return;
    }

    this.sweepRunning = true;
    try {
      await this.processBatch();
    } finally {
      this.sweepRunning = false;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async processBatch(): Promise<void> {
    const now = new Date();

    const entries = await this.outboxRepo.find({
      where: [
        { status: OutboxStatus.PENDING },
        {
          status: OutboxStatus.FAILED,
          next_attempt_at: LessThanOrEqual(now),
        },
      ],
      order: { created_at: 'ASC' },
      take: BATCH_SIZE,
    });

    if (entries.length === 0) return;

    this.logger.log(`Outbox sweep: processing ${entries.length} entries.`);

    // Mark all as PROCESSING atomically to prevent double-processing.
    await this.outboxRepo.update(
      { id: In(entries.map((e) => e.id)) },
      { status: OutboxStatus.PROCESSING },
    );

    for (const entry of entries) {
      await this.processEntry(entry);
    }
  }

  private async processEntry(entry: NotificationOutboxEntry): Promise<void> {
    const event = entry.payload as unknown as NotificationEvent;
    // Restore the Date object which is serialised as a string in JSONB.
    event.timestamp = new Date(event.timestamp);

    const notificationType = event.eventType as NotificationEventType;

    try {
      await this.notificationsService.notifyOnChainEvent(
        notificationType,
        event.actorId,
        event.resourceId,
        entry.patient_id,
        event.metadata,
      );

      await this.outboxRepo.update(entry.id, {
        status: OutboxStatus.COMPLETED,
        last_error: null,
      });

      this.logger.debug(
        `Outbox entry ${entry.id} (${entry.dedupe_key}) completed.`,
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const nextAttempts = entry.attempts + 1;
      const exhausted = nextAttempts >= entry.max_attempts;

      const nextAttemptAt = exhausted
        ? null
        : new Date(Date.now() + BASE_DELAY_MS * Math.pow(2, nextAttempts - 1));

      await this.outboxRepo.update(entry.id, {
        status: OutboxStatus.FAILED,
        attempts: nextAttempts,
        last_error: errorMsg,
        next_attempt_at: nextAttemptAt,
      });

      this.logger.warn(
        `Outbox entry ${entry.id} failed (attempt ${nextAttempts}/${entry.max_attempts}): ${errorMsg}`,
      );

      if (exhausted) {
        this.logger.error(
          `Outbox entry ${entry.id} (${entry.dedupe_key}) permanently failed after ${nextAttempts} attempts.`,
        );
      }
    }
  }
}
