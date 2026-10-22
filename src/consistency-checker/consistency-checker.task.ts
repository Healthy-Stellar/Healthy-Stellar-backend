import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisLockService } from '../common/utils/redis-lock.service';
import { ConsistencyCheckerService } from './consistency-checker.service';

@Injectable()
export class ConsistencyCheckerTask {
  private readonly logger = new Logger(ConsistencyCheckerTask.name);
  private readonly LOCK_KEY = 'lock:consistency-checker';
  private readonly LOCK_TTL_MS = 120_000;

  constructor(
    private readonly checker: ConsistencyCheckerService,
    private readonly redisLock: RedisLockService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const acquired = await this.redisLock.acquireLock(this.LOCK_KEY, this.LOCK_TTL_MS);
    if (!acquired) {
      this.logger.warn('ConsistencyCheckerTask: could not acquire lock, skipping');
      return;
    }

    try {
      const report = await this.checker.runFullCheck();
      if (!report.healthy) {
        this.logger.error(
          `[ConsistencyChecker] ${report.drifts.length} drift(s) at ${report.checkedAt.toISOString()}`,
        );
      }
    } finally {
      await this.redisLock.releaseLock(this.LOCK_KEY);
    }
  }
}
