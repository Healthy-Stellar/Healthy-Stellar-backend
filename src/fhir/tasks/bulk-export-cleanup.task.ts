import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BulkExportService } from '../services/bulk-export.service';

@Injectable()
export class BulkExportCleanupTask {
  constructor(private readonly exportService: BulkExportService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup() {
    await this.exportService.cleanupExpiredJobs();
  }
}
