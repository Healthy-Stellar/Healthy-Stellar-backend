import {
  EventSubscriber,
  EntitySubscriberInterface,
  QueryRunner,
} from 'typeorm';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Counter } from 'prom-client';
import { SlowQueryAlertService } from './slow-query-alert.service';

/** In-memory store of the last 100 slow query log entries. */
export interface SlowQueryEntry {
  sql: string;
  parameters: any[];
  durationMs: number;
  recordedAt: Date;
}

const MAX_SLOW_QUERY_STORE = 100;

@Injectable()
@EventSubscriber()
export class SlowQuerySubscriber
  implements EntitySubscriberInterface, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SlowQuerySubscriber.name);
  private readonly thresholdMs: number;
  private readonly slowQueryStore: SlowQueryEntry[] = [];
  private readonly windowMs = 60_000; // 1 minute
  private readonly alertThreshold = 10;
  private windowStart = Date.now();
  private windowCount = 0;

  /** Prometheus counter exposed as `query_slow_total` */
  private readonly slowCounter: Counter;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly alertService: SlowQueryAlertService,
  ) {
    this.thresholdMs = this.configService.get<number>('SLOW_QUERY_THRESHOLD_MS', 500);

    this.slowCounter = new Counter({
      name: 'query_slow_total',
      help: 'Total number of slow database queries exceeding SLOW_QUERY_THRESHOLD_MS',
      labelNames: ['operation'],
    });
  }

  onModuleInit() {
    this.dataSource.subscribers.push(this);
  }

  onModuleDestroy() {
    const idx = this.dataSource.subscribers.indexOf(this);
    if (idx !== -1) this.dataSource.subscribers.splice(idx, 1);
  }

  /** Called by TypeORM before every query. We store the start time on the QueryRunner. */
  beforeQuery(event: { query: string; parameters?: any[]; queryRunner?: QueryRunner }) {
    if (event.queryRunner) {
      (event.queryRunner as any).__slowQueryStart = Date.now();
    }
  }

  /** Called by TypeORM after every query. */
  afterQuery(event: { query: string; parameters?: any[]; queryRunner?: QueryRunner }) {
    const start: number | undefined = event.queryRunner
      ? (event.queryRunner as any).__slowQueryStart
      : undefined;

    if (start === undefined) return;

    const durationMs = Date.now() - start;
    if (durationMs < this.thresholdMs) return;

    const operation = this.extractOperation(event.query);

    this.slowCounter.inc({ operation });

    const entry: SlowQueryEntry = {
      sql: this.sanitize(event.query),
      parameters: this.sanitizeParams(event.parameters ?? []),
      durationMs,
      recordedAt: new Date(),
    };

    // Rolling 100-entry store
    this.slowQueryStore.unshift(entry);
    if (this.slowQueryStore.length > MAX_SLOW_QUERY_STORE) {
      this.slowQueryStore.length = MAX_SLOW_QUERY_STORE;
    }

    this.logger.warn(
      `Slow query detected (${durationMs}ms ≥ ${this.thresholdMs}ms): ${entry.sql.slice(0, 200)}`,
      { parameters: entry.parameters },
    );

    // Rolling 1-minute window counter for ops alert
    const now = Date.now();
    if (now - this.windowStart > this.windowMs) {
      this.windowStart = now;
      this.windowCount = 0;
    }
    this.windowCount++;

    if (this.windowCount >= this.alertThreshold) {
      this.alertService.sendOpsAlert(this.windowCount, this.windowMs).catch((err) => {
        this.logger.error(`Failed to send slow-query ops alert: ${err.message}`);
      });
      // Reset so we don't spam
      this.windowCount = 0;
      this.windowStart = Date.now();
    }
  }

  getSlowQueries(): SlowQueryEntry[] {
    return this.slowQueryStore;
  }

  private extractOperation(sql: string): string {
    const m = sql.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i);
    return m ? m[1].toUpperCase() : 'UNKNOWN';
  }

  private sanitize(sql: string): string {
    return sql
      .slice(0, 1000)
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
      .replace(/\b\d{16}\b/g, '[CARD]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  }

  private sanitizeParams(params: any[]): any[] {
    return params.map((p) =>
      typeof p === 'string' && p.length > 100 ? p.slice(0, 100) + '…' : p,
    );
  }
}
