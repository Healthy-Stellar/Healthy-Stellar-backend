import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LedgerReconciliationService } from './ledger-reconciliation.service';

/** Runs every 15 minutes: "0 */15 * * * *" */
const EVERY_15_MINUTES = '0 */15 * * * *';

@Injectable()
export class ReconciliationJob {
  private readonly logger = new Logger(ReconciliationJob.name);

  constructor(private readonly reconciliation: LedgerReconciliationService) {}

  @Cron(EVERY_15_MINUTES)
  async handleCron(): Promise<void> {
    this.logger.log('Scheduled ledger reconciliation started');
    const summary = await this.reconciliation.run();
    this.logger.log(
      `Reconciliation complete — checked:${summary.recordsChecked} ` +
        `confirmed:${summary.confirmed} failed:${summary.failed} ` +
        `missing:${summary.missing} errors:${summary.errors}`,
    );
  }
}
