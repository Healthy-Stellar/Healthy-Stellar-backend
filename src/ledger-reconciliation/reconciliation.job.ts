import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import { StellarBalanceReconciliationService } from './stellar-balance-reconciliation.service';

/** Runs every 2 hours as a safety-net behind the SSE stream (Issue #315). */
const EVERY_2_HOURS = '0 0 */2 * * *';

/** Nightly at 02:00 UTC — Stellar account balance vs internal ledger check. */
const NIGHTLY_02_UTC = '0 2 * * *';

@Injectable()
export class ReconciliationJob {
  private readonly logger = new Logger(ReconciliationJob.name);

  constructor(
    private readonly reconciliation: LedgerReconciliationService,
    private readonly balanceReconciliation: StellarBalanceReconciliationService,
  ) {}

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

  @Cron(NIGHTLY_02_UTC)
  async handleNightlyBalanceCheck(): Promise<void> {
    this.logger.log('Nightly Stellar balance reconciliation started');
    try {
      const report = await this.balanceReconciliation.runBalanceReconciliation();
      this.logger.log(
        `Balance reconciliation complete — accounts:${report.accountsChecked} ` +
          `matched:${report.matched} unmatched:${report.unmatched} ` +
          `discrepancy:${report.discrepancyTotal} XLM alertSent:${report.alertSent}`,
      );
    } catch (err: any) {
      this.logger.error(`Nightly balance reconciliation failed: ${(err as Error).message}`);
    }
  }
}
