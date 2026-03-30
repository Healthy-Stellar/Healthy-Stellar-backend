import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionManagementService } from '../services/session-management.service';

@Injectable()
export class SessionCleanupTask {
  private readonly logger = new Logger(SessionCleanupTask.name);

  constructor(private readonly sessionManagementService: SessionManagementService) {}

  /**
   * Daily job: hard-delete sessions whose expiresAt is older than 30 days.
   * Prevents unbounded growth of the sessions table.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredSessionCleanup(): Promise<void> {
    this.logger.log('SessionCleanupTask started');
    try {
      const deleted = await this.sessionManagementService.deleteOldExpiredSessions();
      this.logger.log(`SessionCleanupTask finished — deleted ${deleted} old session(s)`);
    } catch (error) {
      this.logger.error('SessionCleanupTask failed', error instanceof Error ? error.stack : error);
    }
  }
}
