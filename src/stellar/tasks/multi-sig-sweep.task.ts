import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MultiSigTransactionService } from '../services/multi-sig-transaction.service';

@Injectable()
export class MultiSigSweepTask {
  private readonly logger = new Logger(MultiSigSweepTask.name);

  constructor(private readonly multiSigService: MultiSigTransactionService) {}

  /** Re-enqueue APPROVED payments that have not been executed yet (lost or failed jobs). */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleSweep(): Promise<void> {
    this.logger.log('Running multi-sig sweep for unexecuted transactions');
    try {
      const count = await this.multiSigService.sweepApprovedTransactions();
      this.logger.log(`Sweep enqueued ${count} transactions`);
    } catch (error) {
      this.logger.error(`Multi-sig sweep failed: ${error.message}`);
    }
  }
}
