import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import Redis from 'ioredis';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Record } from '../records/entities/record.entity';
import { AccessGrant, GrantStatus } from '../access-control/entities/access-grant.entity';

export type StreamStatus = 'connected' | 'reconnecting' | 'failed';

const CURSOR_KEY = 'stellar:stream:cursor';
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes
const BASE_BACKOFF_MS = 1_000;

@Injectable()
export class StellarStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StellarStreamService.name);

  status: StreamStatus = 'reconnecting';

  private redis: Redis;
  private horizon: StellarSdk.Horizon.Server;
  private contractAddress: string;
  private stopStream: (() => void) | null = null;
  private destroyed = false;
  private retryCount = 0;
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(Record)
    private readonly recordRepo: Repository<Record>,
    @InjectRepository(AccessGrant)
    private readonly grantRepo: Repository<AccessGrant>,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
    @InjectMetric('medchain_stellar_stream_events_processed_total')
    private readonly eventsCounter: Counter<string>,
  ) {}

  onModuleInit(): void {
    const isMainnet = this.config.get('STELLAR_NETWORK') === 'mainnet';
    this.horizon = new StellarSdk.Horizon.Server(
      isMainnet ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org',
      { allowHttp: false },
    );
    this.contractAddress = this.config.get<string>('STELLAR_CONTRACT_ID', '');
    this.redis = new Redis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get('REDIS_PASSWORD'),
      lazyConnect: true,
    });
    this.redis.connect().catch(() => {
      this.logger.warn('Redis unavailable — stream cursor will not be persisted');
    });
    this._connect();
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.stopStream) this.stopStream();
    this.redis.disconnect();
  }

  // ── Connection ─────────────────────────────────────────────────────────────

  async _connect(): Promise<void> {
    if (this.destroyed) return;

    const cursor = await this._getCursor();
    this.logger.log(`Connecting to Stellar SSE stream (cursor=${cursor})`);

    try {
      const builder = this.horizon
        .transactions()
        .cursor(cursor)
        .limit(200)
        .stream({
          onmessage: (tx) => this._handleTransaction(tx as any),
          onerror: (err) => {
            this.logger.warn(`Stream error: ${(err as any)?.message ?? err}`);
            this._scheduleReconnect();
          },
        });

      // The Stellar SDK stream() returns a close function
      this.stopStream = builder as unknown as () => void;
      this.status = 'connected';
      this.retryCount = 0;
      this.logger.log('Stellar SSE stream connected');
    } catch (err) {
      this.logger.error(`Failed to open stream: ${(err as Error).message}`);
      this._scheduleReconnect();
    }
  }

  private _scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.stopStream) {
      try { (this.stopStream as any)(); } catch { /* ignore */ }
      this.stopStream = null;
    }
    this.status = 'reconnecting';
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** this.retryCount, MAX_BACKOFF_MS);
    this.retryCount++;
    this.logger.warn(`Reconnecting in ${delay}ms (attempt ${this.retryCount})`);
    this.retryTimer = setTimeout(() => this._connect(), delay);
  }

  // ── Event handling ─────────────────────────────────────────────────────────

  async _handleTransaction(tx: StellarSdk.Horizon.ServerApi.TransactionRecord): Promise<void> {
    try {
      // Filter: only process txs involving our contract address
      if (this.contractAddress && !this._involvesContract(tx)) {
        this.eventsCounter.inc({ result: 'skipped' });
        await this._saveCursor(tx.paging_token);
        return;
      }

      const isSuccess = tx.successful;
      const hash = tx.hash;

      // Try record first, then access grant
      const record = await this.recordRepo.findOne({ where: { stellarTxHash: hash } });
      if (record) {
        if (isSuccess) {
          this.events.emit('record.anchored', { recordId: record.id, txHash: hash });
        } else {
          this.events.emit('record.anchor.failed', { recordId: record.id, txHash: hash });
        }
        this.eventsCounter.inc({ result: isSuccess ? 'confirmed' : 'failed' });
        await this._saveCursor(tx.paging_token);
        return;
      }

      const grant = await this.grantRepo.findOne({ where: { sorobanTxHash: hash } });
      if (grant) {
        if (isSuccess) {
          this.events.emit('access.grant.confirmed', { grantId: grant.id, txHash: hash });
        } else {
          this.events.emit('access.grant.failed', { grantId: grant.id, txHash: hash });
        }
        this.eventsCounter.inc({ result: isSuccess ? 'confirmed' : 'failed' });
        await this._saveCursor(tx.paging_token);
        return;
      }

      // No matching record — still advance cursor
      this.eventsCounter.inc({ result: 'skipped' });
      await this._saveCursor(tx.paging_token);
    } catch (err) {
      this.logger.error(`Error processing tx ${tx?.hash}: ${(err as Error).message}`);
      this.eventsCounter.inc({ result: 'error' });
    }
  }

  private _involvesContract(tx: StellarSdk.Horizon.ServerApi.TransactionRecord): boolean {
    // The envelope_xdr contains the source account; for Soroban invocations the
    // contract address appears in the operations. A lightweight check on the raw
    // XDR string is sufficient to filter without full decode overhead.
    return (
      tx.source_account === this.contractAddress ||
      (tx.envelope_xdr ?? '').includes(this.contractAddress)
    );
  }

  // ── Redis cursor ───────────────────────────────────────────────────────────

  async _getCursor(): Promise<string> {
    try {
      const val = await this.redis.get(CURSOR_KEY);
      return val ?? 'now';
    } catch {
      return 'now';
    }
  }

  async _saveCursor(pagingToken: string): Promise<void> {
    try {
      await this.redis.set(CURSOR_KEY, pagingToken);
    } catch {
      // Non-fatal — cursor will reset to 'now' on next restart
    }
  }
}
