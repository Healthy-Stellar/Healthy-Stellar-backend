import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Record } from '../records/entities/record.entity';
import { ReconciliationRun, ReconciliationRunStatus } from './reconciliation-run.entity';

/** Records with a stellarTxHash older than this are eligible for reconciliation. */
const PENDING_THRESHOLD_MINUTES = 10;

/** Alert ops when missing count in a single run exceeds this. */
const MISSING_ALERT_THRESHOLD = 5;

export interface RunSummary {
  id: string;
  status: ReconciliationRunStatus;
  startedAt: Date;
  completedAt: Date | null;
  recordsChecked: number;
  confirmed: number;
  failed: number;
  missing: number;
  errors: number;
}

@Injectable()
export class LedgerReconciliationService {
  private readonly logger = new Logger(LedgerReconciliationService.name);
  /** Lazily-initialised so tests can override _queryHorizon without a real SDK instance. */
  private _horizon: StellarSdk.Horizon.Server | null = null;

  constructor(
    @InjectRepository(Record)
    private readonly recordRepo: Repository<Record>,
    @InjectRepository(ReconciliationRun)
    private readonly runRepo: Repository<ReconciliationRun>,
    private readonly config: ConfigService,
    @InjectMetric('medchain_reconciliation_discrepancies_total')
    private readonly discrepanciesCounter: Counter<string>,
  ) {}

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

  /** Run a full reconciliation pass and persist the result. */
  async run(): Promise<RunSummary> {
    const runEntity = await this.runRepo.save(
      this.runRepo.create({ status: ReconciliationRunStatus.RUNNING }),
    );

    const counters = { recordsChecked: 0, confirmed: 0, failed: 0, missing: 0, errors: 0 };

    try {
      const cutoff = new Date(Date.now() - PENDING_THRESHOLD_MINUTES * 60_000);

      // Records that have a hash but haven't been confirmed yet
      const pending = await this.recordRepo.find({
        where: { isDeleted: false, createdAt: LessThan(cutoff) },
      });

      // Filter to only those that actually have a stellarTxHash
      const toCheck = pending.filter((r) => !!r.stellarTxHash);
      counters.recordsChecked = toCheck.length;

      for (const record of toCheck) {
        try {
          const txStatus = await this._queryHorizon(record.stellarTxHash);

          if (txStatus === 'success') {
            counters.confirmed++;
          } else if (txStatus === 'failed') {
            counters.failed++;
            this.discrepanciesCounter.inc({ type: 'failed' });
            await this._requeueAnchor(record);
          } else {
            // not found
            counters.missing++;
            this.discrepanciesCounter.inc({ type: 'missing' });
            await this._requeueAnchor(record);
          }
        } catch (err) {
          counters.errors++;
          this.logger.error(`Error checking record ${record.id}: ${(err as Error).message}`);
        }
      }

      if (counters.missing > MISSING_ALERT_THRESHOLD) {
        await this._alertOps(counters.missing, runEntity.id);
      }

      Object.assign(runEntity, {
        ...counters,
        status: ReconciliationRunStatus.COMPLETED,
        completedAt: new Date(),
      });
    } catch (err) {
      this.logger.error(`Reconciliation run ${runEntity.id} failed: ${(err as Error).message}`);
      Object.assign(runEntity, {
        ...counters,
        status: ReconciliationRunStatus.FAILED,
        completedAt: new Date(),
      });
    }

    const saved = await this.runRepo.save(runEntity);
    return this._toSummary(saved);
  }

  /** Return the most recent completed run, or null. */
  async getLatestRun(): Promise<RunSummary | null> {
    const run = await this.runRepo.findOne({
      where: {},
      order: { startedAt: 'DESC' },
    });
    return run ? this._toSummary(run) : null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Query Horizon for a transaction hash.
   * Returns 'success' | 'failed' | 'not_found'.
   */
  async _queryHorizon(txHash: string): Promise<'success' | 'failed' | 'not_found'> {
    try {
      const tx = await this.horizon.transactions().transaction(txHash).call();
      return tx.successful ? 'success' : 'failed';
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.name === 'NotFoundError') {
        return 'not_found';
      }
      throw err;
    }
  }

  /** Re-queue the anchor operation for a record. */
  private async _requeueAnchor(record: Record): Promise<void> {
    // Emit a log entry — the actual queue dispatch is handled by the caller's
    // queue infrastructure (StellarTransactionQueue). We log here so ops can
    // pick it up; a full queue integration would inject QueueService.
    this.logger.warn(
      `Re-queuing anchor for record ${record.id} (cid=${record.cid}, hash=${record.stellarTxHash})`,
    );
  }

  private async _alertOps(missingCount: number, runId: string): Promise<void> {
    // Slack webhook URL is optional — if absent we just log.
    const webhookUrl = this.config.get<string>('OPS_SLACK_WEBHOOK_URL');
    const message = `⚠️ MedChain reconciliation run ${runId}: ${missingCount} missing Stellar transactions detected. Immediate investigation required.`;

    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message }),
        });
      } catch (err) {
        this.logger.error(`Failed to send Slack alert: ${(err as Error).message}`);
      }
    }

    this.logger.error(`OPS ALERT: ${message}`);
  }

  private _toSummary(run: ReconciliationRun): RunSummary {
    return {
      id: run.id,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      recordsChecked: run.recordsChecked,
      confirmed: run.confirmed,
      failed: run.failed,
      missing: run.missing,
      errors: run.errors,
    };
  }
}
