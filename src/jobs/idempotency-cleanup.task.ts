import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdempotencyService } from '../idempotency/idempotency.service';

@Injectable()
export class IdempotencyCleanupTask {
  private readonly logger = new Logger(IdempotencyCleanupTask.name);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup(): Promise<void> {
    const start = Date.now();
    const purged = await this.idempotencyService.deleteExpired();
    this.logger.log(
      `IdempotencyCleanupTask finished — purged: ${purged}, duration: ${Date.now() - start}ms`,
    );
  }
}
