import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MultiSigTransactionService } from '../services/multi-sig-transaction.service';

@Injectable(){}
export class MultiSigSweepTask {
  private readonly logger = new Logger(MultiSigSweepTask.name);

  constructor(
    private readonly multiSigService: MultiSigTransactionService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleSweep() {
    this.logger.log('Running multi-sig sweep for unexecuted transactions');
    const count = await this.multiSigService.sweepApprovedTransactions();
    this.logger.log(`Sweep enqueud ${count} transactions`);
  }
}
