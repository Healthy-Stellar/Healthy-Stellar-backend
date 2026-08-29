import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisLockService } from '../../common/utils/redis-lock.service';
import { EnvelopeKeyManagementService } from './envelope-key-management.service';

export interface RotationStatus {
  lastRotatedAt: Date | null;
  nextRotationAt: Date | null;
  intervalDays: number;
  inProgress: boolean;
  lastResult: { reencryptedCount: number; completedAt: Date } | null;
}

/** Redis key guarding KEK rotation across instances. */
export const KEK_ROTATION_LOCK_KEY = 'lock:kek-rotation';

/**
 * How long the distributed lock is held. Rotation re-encrypts every DEK, so
 * this has to outlast the slowest realistic run — if it expired early another
 * instance could start a second rotation. Configurable via
 * KEK_ROTATION_LOCK_TTL_MS.
 */
export const DEFAULT_KEK_ROTATION_LOCK_TTL_MS = 30 * 60 * 1000;

/** Thrown, and matched, when a rotation is already running anywhere. */
export const ROTATION_IN_PROGRESS_MESSAGE = 'KEK rotation already in progress';

@Injectable()
export class KekRotationService {
  private readonly logger = new Logger(KekRotationService.name);
  private inProgress = false;
  private lastResult: { reencryptedCount: number; completedAt: Date } | null = null;
  private lastRotatedAt: Date | null = null;

  constructor(
    private readonly keyManagement: EnvelopeKeyManagementService,
    private readonly config: ConfigService,
    private readonly redisLock: RedisLockService,
  ) {}

  // Runs every day at midnight; checks if rotation interval has elapsed
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduledRotation(): Promise<void> {
    const intervalDays = this.config.get<number>('KEK_ROTATION_INTERVAL_DAYS', 90);
    if (this.lastRotatedAt) {
      const diffDays = (Date.now() - this.lastRotatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < intervalDays) return;
    }
    // Losing the lock is the expected case for a replica, not an error:
    // another instance is already rotating, so this one has nothing to do.
    try {
      await this.rotate('scheduler');
    } catch (error) {
      if (error instanceof Error && error.message === ROTATION_IN_PROGRESS_MESSAGE) {
        this.logger.log('Scheduled KEK rotation skipped: another instance is rotating');
        return;
      }
      throw error;
    }
  }

  /**
   * Rotate the master key.
   *
   * `inProgress` is kept as a cheap local short-circuit, but it only ever saw
   * one process. On a multi-instance deployment every replica runs the same
   * midnight cron with its own copy of that flag, so all of them would rotate
   * the master key and re-encrypt every DEK concurrently. The Redis lock is
   * the real guard; the flag just avoids a round-trip in the obvious case.
   *
   * @param operatorId - Who requested the rotation ('scheduler' for the cron)
   * @throws {Error} When a rotation is already running, here or on another instance
   */
  async rotate(operatorId: string): Promise<{ reencryptedCount: number }> {
    if (this.inProgress) {
      throw new Error(ROTATION_IN_PROGRESS_MESSAGE);
    }
    // Claimed synchronously, before the first await. Setting it after the lock
    // round-trip would leave a window where a second concurrent caller in this
    // same process passes the check above.
    this.inProgress = true;

    const ttlMs = this.config.get<number>(
      'KEK_ROTATION_LOCK_TTL_MS',
      DEFAULT_KEK_ROTATION_LOCK_TTL_MS,
    );
    const acquired = await this.redisLock.acquireLock(KEK_ROTATION_LOCK_KEY, ttlMs);
    if (!acquired) {
      this.inProgress = false;
      this.logger.warn(
        `KEK rotation requested by ${operatorId} but another instance holds the lock`,
      );
      throw new Error(ROTATION_IN_PROGRESS_MESSAGE);
    }

    this.logger.log(`KEK rotation started by ${operatorId}`);
    try {
      const result = await this.keyManagement.rotateMasterKey(operatorId);
      this.lastRotatedAt = new Date();
      this.lastResult = { reencryptedCount: result.reencryptedCount, completedAt: this.lastRotatedAt };
      this.logger.log(`KEK rotation completed: ${result.reencryptedCount} DEKs re-encrypted`);
      return result;
    } finally {
      this.inProgress = false;
      await this.redisLock.releaseLock(KEK_ROTATION_LOCK_KEY);
    }
  }

  getStatus(): RotationStatus {
    const intervalDays = this.config.get<number>('KEK_ROTATION_INTERVAL_DAYS', 90);
    const nextRotationAt = this.lastRotatedAt
      ? new Date(this.lastRotatedAt.getTime() + intervalDays * 24 * 60 * 60 * 1000)
      : null;
    return {
      lastRotatedAt: this.lastRotatedAt,
      nextRotationAt,
      intervalDays,
      inProgress: this.inProgress,
      lastResult: this.lastResult,
    };
  }
}
