import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { LedgerReconciliationReport } from './ledger-reconciliation-report.entity';
import { NotificationsService } from '../notifications/services/notifications.service';

interface AccountDetail {
  accountId: string;
  horizonBalance: string;
  internalBalance: string;
  discrepancy: string;
  status: 'matched' | 'unmatched' | 'not_found';
}

@Injectable()
export class StellarBalanceReconciliationService {
  private readonly logger = new Logger(StellarBalanceReconciliationService.name);
  private _horizon: StellarSdk.Horizon.Server | null = null;

  /** XLM discrepancy (per account) above this value triggers an alert. Configurable via env. */
  private readonly thresholdXlm: number;
  private readonly adminEmail: string;

  constructor(
    @InjectRepository(LedgerReconciliationReport)
    private readonly reportRepo: Repository<LedgerReconciliationReport>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    this.thresholdXlm = parseFloat(
      this.config.get<string>('RECONCILIATION_DISCREPANCY_THRESHOLD_XLM', '1.0'),
    );
    this.adminEmail = this.config.get<string>('ADMIN_EMAIL', 'admin@healthystellar.io');
  }

  private get horizon(): StellarSdk.Horizon.Server {
    if (!this._horizon) {
      const isMainnet = this.config.get('STELLAR_NETWORK') === 'mainnet';
      this._horizon = new StellarSdk.Horizon.Server(
        isMainnet
          ? 'https://horizon.stellar.org'
          : 'https://horizon-testnet.stellar.org',
        { allowHttp: false },
      );
    }
    return this._horizon;
  }

  /**
   * Runs a full Stellar vs database balance reconciliation.
   * Fetches all account balances from Horizon and compares against internal ledger totals.
   */
  async runBalanceReconciliation(): Promise<LedgerReconciliationReport> {
    this.logger.log('Starting Stellar balance reconciliation');

    // Collect all Stellar account IDs tracked in the database
    const accounts = await this.collectStellarAccounts();
    const details: AccountDetail[] = [];
    let matched = 0;
    let unmatched = 0;
    let totalDiscrepancy = 0;

    for (const accountId of accounts) {
      const detail = await this.reconcileAccount(accountId);
      details.push(detail);

      if (detail.status === 'matched') {
        matched++;
      } else {
        unmatched++;
        totalDiscrepancy += Math.abs(parseFloat(detail.discrepancy));
      }
    }

    const thresholdExceeded = totalDiscrepancy > this.thresholdXlm;

    const report = await this.reportRepo.save(
      this.reportRepo.create({
        accountsChecked: accounts.length,
        matched,
        unmatched,
        discrepancyTotal: totalDiscrepancy.toFixed(7),
        discrepancyThresholdExceeded: thresholdExceeded,
        alertSent: false,
        details,
      }),
    );

    if (thresholdExceeded) {
      await this.sendDiscrepancyAlert(report);
      await this.reportRepo.update(report.id, { alertSent: true });
      report.alertSent = true;
    }

    this.logger.log(
      `Balance reconciliation complete — checked: ${accounts.length}, ` +
        `matched: ${matched}, unmatched: ${unmatched}, ` +
        `discrepancyTotal: ${totalDiscrepancy.toFixed(7)} XLM, ` +
        `thresholdExceeded: ${thresholdExceeded}`,
    );

    return report;
  }

  async getReports(limit = 50): Promise<LedgerReconciliationReport[]> {
    return this.reportRepo.find({
      order: { runAt: 'DESC' },
      take: limit,
    });
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Collects unique Stellar account IDs from the patients and providers tables. */
  private async collectStellarAccounts(): Promise<string[]> {
    const rows: Array<{ stellarAddress: string }> = await this.dataSource.query(
      `SELECT DISTINCT "stellarAddress" FROM patients
       WHERE "stellarAddress" IS NOT NULL AND "stellarAddress" <> ''`,
    );
    return rows.map((r) => r.stellarAddress);
  }

  /** Reconciles a single Stellar account: compares Horizon balance vs internal ledger total. */
  private async reconcileAccount(accountId: string): Promise<AccountDetail> {
    let horizonBalance = '0';

    try {
      const account = await this.horizon.loadAccount(accountId);
      const nativeEntry = account.balances.find(
        (b): b is StellarSdk.Horizon.HorizonApi.BalanceLine & { asset_type: 'native' } =>
          b.asset_type === 'native',
      );
      horizonBalance = nativeEntry?.balance ?? '0';
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.name === 'NotFoundError') {
        return {
          accountId,
          horizonBalance: '0',
          internalBalance: '0',
          discrepancy: '0',
          status: 'not_found',
        };
      }
      this.logger.error(`Horizon fetch failed for ${accountId}: ${(err as Error).message}`);
      return {
        accountId,
        horizonBalance: '0',
        internalBalance: '0',
        discrepancy: '0',
        status: 'unmatched',
      };
    }

    const internalBalance = await this.getInternalBalance(accountId);
    const discrepancy = (
      parseFloat(horizonBalance) - parseFloat(internalBalance)
    ).toFixed(7);
    const isMatched = Math.abs(parseFloat(discrepancy)) <= 0.0000001;

    return {
      accountId,
      horizonBalance,
      internalBalance,
      discrepancy,
      status: isMatched ? 'matched' : 'unmatched',
    };
  }

  /**
   * Retrieves the internal ledger total for a Stellar account.
   * Returns the sum of net confirmed payment amounts tracked in the database.
   */
  private async getInternalBalance(accountId: string): Promise<string> {
    // Query the internal ledger: sum of all confirmed incoming payments minus outgoing
    // for this Stellar account. Falls back to '0' when no ledger entries exist.
    const result: Array<{ total: string }> = await this.dataSource.query(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM stellar_ledger_entries
       WHERE account_id = $1 AND status = 'confirmed'`,
      [accountId],
    ).catch(() => [{ total: '0' }]);

    return result[0]?.total ?? '0';
  }

  private async sendDiscrepancyAlert(report: LedgerReconciliationReport): Promise<void> {
    try {
      await this.notifications.sendEmail(
        this.adminEmail,
        `[ALERT] Stellar balance discrepancy: ${report.discrepancyTotal} XLM`,
        'reconciliation-alert',
        {
          reportId: report.id,
          accountsChecked: report.accountsChecked,
          matched: report.matched,
          unmatched: report.unmatched,
          discrepancyTotal: report.discrepancyTotal,
          threshold: this.thresholdXlm,
          runAt: report.runAt.toISOString(),
        },
      );
    } catch (err: any) {
      this.logger.error(`Failed to send discrepancy alert: ${(err as Error).message}`);
    }
  }
}
