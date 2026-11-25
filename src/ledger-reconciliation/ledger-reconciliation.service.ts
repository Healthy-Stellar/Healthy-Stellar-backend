import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, In, Not, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import * as StellarSdk from '@stellar/stellar-sdk';
import { v4 as uuidv4 } from 'uuid';
import { Record, RecordAnchorStatus } from '../records/entities/record.entity';
import { ReconciliationRun, ReconciliationRunStatus } from './reconciliation-run.entity';
import { QueueService } from '../queues/queue.service';
import { JOB_TYPES } from '../queues/queue.constants';

/** Records with a stellarTxHash older than this are eligible for reconciliation. */
const PENDING_THRESHOLD_MINUTES = 10;

/** Alert ops when missing count in a single run exceeds this. */
const MISSING_ALERT_THRESHOLD = 5;

/** Max times reconciliation re-queues the anchor for the same record. */
const MAX_REQUEUE_ATTEMPTS = 3;

/** Records loaded per page; keyset-paged by id so confirmed rows dropping out is safe. */
const BATCH_SIZE = 100;

/** Concurrent Horizon requests per batch. */
const HORIZON_CONCURRENCY = 5;

/** Retries on Horizon HTTP 429 with exponential backoff from this base delay. */
const HORIZON_MAX_RETRIES = 4;
const HORIZON_BACKOFF_BASE_MS = 1_000;

/** A RUNNING row older than this is treated as a crashed run and no longer blocks new runs. */
const RUN_LOCK_STALE_MINUTES = 60;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    private readonly queueService: QueueService,
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
    // shortcut: RUNNING-row check is not atomic, two instances starting at the same instant can both run; upgrade to a DB advisory lock if multi-instance cron is enabled
    const staleCutoff = new Date(Date.now() - RUN_LOCK_STALE_MINUTES * 60_000);
    const active = await this.runRepo.findOne({
      where: { status: ReconciliationRunStatus.RUNNING, startedAt: MoreThan(staleCutoff) },
    });
    if (active) {
      this.logger.warn(`Reconciliation skipped: run ${active.id} is still in progress`);
      return this._toSummary(active);
    }

    const runEntity = await this.runRepo.save(
      this.runRepo.create({ status: ReconciliationRunStatus.RUNNING }),
    );

    const counters = { recordsChecked: 0, confirmed: 0, failed: 0, missing: 0, errors: 0 };

    try {
      const cutoff = new Date(Date.now() - PENDING_THRESHOLD_MINUTES * 60_000);
      let lastId: string | undefined;

      // Only anchors not yet CONFIRMED, paged by id
      for (;;) {
        const batch = await this.recordRepo.find({
          where: {
            isDeleted: false,
            createdAt: LessThan(cutoff),
            stellarTxHash: Not(IsNull()),
            anchorStatus: In([RecordAnchorStatus.PENDING, RecordAnchorStatus.FAILED]),
            ...(lastId ? { id: MoreThan(lastId) } : {}),
          },
          order: { id: 'ASC' },
          take: BATCH_SIZE,
        });
        if (batch.length === 0) break;

        counters.recordsChecked += batch.length;
        for (let i = 0; i < batch.length; i += HORIZON_CONCURRENCY) {
          await Promise.all(
            batch
              .slice(i, i + HORIZON_CONCURRENCY)
              .map((record) => this._reconcileRecord(record, counters)),
          );
        }

        if (batch.length < BATCH_SIZE) break;
        lastId = batch[batch.length - 1].id;
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

  private async _reconcileRecord(
    record: Record,
    counters: { confirmed: number; failed: number; missing: number; errors: number },
  ): Promise<void> {
    try {
      const txStatus = await this._queryHorizon(record.stellarTxHash);

      if (txStatus === 'success') {
        counters.confirmed++;
        await this._setAnchorStatus(record, RecordAnchorStatus.CONFIRMED, new Date());
      } else if (txStatus === 'failed') {
        counters.failed++;
        this.discrepanciesCounter.inc({ type: 'failed' });
        await this._setAnchorStatus(record, RecordAnchorStatus.FAILED);
        await this._requeueAnchor(record);
      } else {
        // not found
        counters.missing++;
        this.discrepanciesCounter.inc({ type: 'missing' });
        await this._setAnchorStatus(record, RecordAnchorStatus.FAILED);
        await this._requeueAnchor(record);
      }
    } catch (err) {
      counters.errors++;
      this.logger.error(`Error checking record ${record.id}: ${(err as Error).message}`);
    }
  }

  private async _setAnchorStatus(
    record: Record,
    anchorStatus: RecordAnchorStatus,
    anchorConfirmedAt: Date | null = null,
  ): Promise<void> {
    // Also update the in-memory entity so a later save() in _requeueAnchor does not revert it
    Object.assign(record, { anchorStatus, anchorConfirmedAt });
    await this.recordRepo.update(record.id, { anchorStatus, anchorConfirmedAt });
  }

  /**
   * Query Horizon for a transaction hash.
   * Returns 'success' | 'failed' | 'not_found'. Retries HTTP 429 with exponential backoff.
   */
  async _queryHorizon(txHash: string): Promise<'success' | 'failed' | 'not_found'> {
    for (let attempt = 0; ; attempt++) {
      try {
        const tx = await this.horizon.transactions().transaction(txHash).call();
        return tx.successful ? 'success' : 'failed';
      } catch (err: any) {
        if (err?.response?.status === 404 || err?.name === 'NotFoundError') {
          return 'not_found';
        }
        if (err?.response?.status === 429 && attempt < HORIZON_MAX_RETRIES) {
          await sleep(HORIZON_BACKOFF_BASE_MS * 2 ** attempt);
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Re-queue the anchor operation for a record via the Stellar transaction queue.
   * Bounded by MAX_REQUEUE_ATTEMPTS so a permanently-broken record cannot
   * generate an unbounded stream of jobs.
   */
  private async _requeueAnchor(record: Record): Promise<void> {
    const attempts = record.reconciliationAttempts ?? 0;

    if (attempts >= MAX_REQUEUE_ATTEMPTS) {
      // Detected, but deliberately NOT re-queued — retry limit reached.
      this.discrepanciesCounter.inc({ type: 'detected_only' });
      this.logger.warn(
        `Reconciliation detected discrepancy for record ${record.id} ` +
          `(cid=${record.cid}, hash=${record.stellarTxHash}) but max re-queue attempts ` +
          `(${MAX_REQUEUE_ATTEMPTS}) reached — detected only, not re-queued`,
      );
      return;
    }

    const correlationId = uuidv4();
    await this.queueService.dispatchStellarTransaction({
      operationType: JOB_TYPES.ANCHOR_RECORD,
      params: { recordId: record.id, patientId: record.patientId, cid: record.cid },
      initiatedBy: 'ledger-reconciliation',
      correlationId,
    });

    record.reconciliationAttempts = attempts + 1;
    await this.recordRepo.save(record);

    this.discrepanciesCounter.inc({ type: 'requeued' });
    this.logger.log(
      `Re-queued anchor for record ${record.id} (cid=${record.cid}, hash=${record.stellarTxHash}) ` +
        `— attempt ${attempts + 1}/${MAX_REQUEUE_ATTEMPTS} (correlation=${correlationId})`,
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
