import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EnvelopeKeyManagementService } from './envelope-key-management.service';

export interface RotationStatus {
  lastRotatedAt: Date | null;
  nextRotationAt: Date | null;
  intervalDays: number;
  inProgress: boolean;
  lastResult: { reencryptedCount: number; completedAt: Date } | null;
}

@Injectable()
export class KekRotationService {
  private readonly logger = new Logger(KekRotationService.name);
  private inProgress = false;
  private lastResult: { reencryptedCount: number; completedAt: Date } | null = null;
  private lastRotatedAt: Date | null = null;

  constructor(
    private readonly keyManagement: EnvelopeKeyManagementService,
    private readonly config: ConfigService,
  ) {}

  // Runs every day at midnight; checks if rotation interval has elapsed
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduledRotation(): Promise<void> {
    const intervalDays = this.config.get<number>('KEK_ROTATION_INTERVAL_DAYS', 90);
    if (this.lastRotatedAt) {
      const diffDays = (Date.now() - this.lastRotatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < intervalDays) return;
    }
    await this.rotate('scheduler');
  }

  async rotate(operatorId: string): Promise<{ reencryptedCount: number }> {
    if (this.inProgress) {
      throw new Error('KEK rotation already in progress');
    }
    this.inProgress = true;
    this.logger.log(`KEK rotation started by ${operatorId}`);
    try {
      const result = await this.keyManagement.rotateMasterKey(operatorId);
      this.lastRotatedAt = new Date();
      this.lastResult = { reencryptedCount: result.reencryptedCount, completedAt: this.lastRotatedAt };
      this.logger.log(`KEK rotation completed: ${result.reencryptedCount} DEKs re-encrypted`);
      return result;
    } finally {
      this.inProgress = false;
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
