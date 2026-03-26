import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LedgerReconciliationService } from './ledger-reconciliation.service';

/** Runs every 2 hours as a safety-net behind the SSE stream (Issue #315). */
const EVERY_2_HOURS = '0 0 */2 * * *';

@Injectable()
export class ReconciliationJob {
  private readonly logger = new Logger(ReconciliationJob.name);

  constructor(private readonly reconciliation: LedgerReconciliationService) {}

  @Cron(EVERY_2_HOURS)
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
