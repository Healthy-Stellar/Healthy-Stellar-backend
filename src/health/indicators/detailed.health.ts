import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { QUEUE_NAMES } from '../../queues/queue.constants';

export interface CheckResult {
  status: 'ok' | 'degraded' | 'down';
  value: unknown;
  threshold: unknown;
  message: string;
}

export interface DetailedHealthResult {
  status: 'ok' | 'degraded' | 'down';
  checks: Record<string, CheckResult>;
}

@Injectable()
export class DetailedHealthIndicator extends HealthIndicator {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectQueue(QUEUE_NAMES.STELLAR_TRANSACTIONS) private stellarQueue: Queue,
    @InjectQueue(QUEUE_NAMES.IPFS_UPLOADS) private ipfsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL_NOTIFICATIONS) private emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REPORTS) private reportsQueue: Queue,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    super();
  }

  async getDetailedHealth(): Promise<DetailedHealthResult> {
    const [db, redis, queues, stellar, ipfs] = await Promise.allSettled([
      this.checkDbPool(),
      this.checkRedisMemory(),
      this.checkQueueDepths(),
      this.checkStellarLag(),
      this.checkIpfs(),
    ]);

    const checks: Record<string, CheckResult> = {
      database: db.status === 'fulfilled' ? db.value : this.errorResult('down', db.reason),
      redis: redis.status === 'fulfilled' ? redis.value : this.errorResult('degraded', redis.reason),
      queues: queues.status === 'fulfilled' ? queues.value : this.errorResult('degraded', queues.reason),
      stellar: stellar.status === 'fulfilled' ? stellar.value : this.errorResult('degraded', stellar.reason),
      ipfs: ipfs.status === 'fulfilled' ? ipfs.value : this.errorResult('degraded', ipfs.reason),
    };

    const status =
      checks.database.status === 'down'
        ? 'down'
        : Object.values(checks).some((c) => c.status !== 'ok')
          ? 'degraded'
          : 'ok';

    return { status, checks };
  }

  private async checkDbPool(): Promise<CheckResult> {
    const driver = this.dataSource.driver as any;
    const pool = driver?.master ?? driver?.pool;
    const active: number = pool?._clients?.filter((c: any) => c._activeQuery)?.length ?? pool?.totalCount ?? 0;
    const idle: number = pool?.idleCount ?? 0;
    const waiting: number = pool?.waitingCount ?? 0;
    const threshold = 80;

    return {
      status: active >= threshold ? 'down' : 'ok',
      value: { active, idle, waiting },
      threshold,
      message:
        active >= threshold
          ? `DB pool exhausted: ${active} active connections`
          : `DB pool healthy: ${active} active, ${idle} idle, ${waiting} waiting`,
    };
  }

  private async checkRedisMemory(): Promise<CheckResult> {
    const Redis = require('ioredis');
    const redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      lazyConnect: true,
      connectTimeout: 5000,
    });

    try {
      await redis.connect();
      const info: string = await redis.info('memory');
      const usedMatch = info.match(/used_memory:(\d+)/);
      const maxMatch = info.match(/maxmemory:(\d+)/);
      const used = usedMatch ? parseInt(usedMatch[1]) : 0;
      const max = maxMatch ? parseInt(maxMatch[1]) : 0;
      const usedMb = Math.round(used / 1024 / 1024);
      const maxMb = max ? Math.round(max / 1024 / 1024) : null;
      const pct = max ? Math.round((used / max) * 100) : null;
      const threshold = 90;
      const degraded = pct !== null && pct >= threshold;

      return {
        status: degraded ? 'degraded' : 'ok',
        value: { usedMb, maxMb, usagePercent: pct },
        threshold: `${threshold}%`,
        message: degraded
          ? `Redis memory usage high: ${pct}%`
          : `Redis memory: ${usedMb}MB used${maxMb ? ` of ${maxMb}MB` : ''}`,
      };
    } finally {
      await redis.quit().catch(() => {});
    }
  }

  private async checkQueueDepths(): Promise<CheckResult> {
    const threshold = 1000;
    const queues = {
      [QUEUE_NAMES.STELLAR_TRANSACTIONS]: this.stellarQueue,
      [QUEUE_NAMES.IPFS_UPLOADS]: this.ipfsQueue,
      [QUEUE_NAMES.EMAIL_NOTIFICATIONS]: this.emailQueue,
      [QUEUE_NAMES.REPORTS]: this.reportsQueue,
    };

    const depths: Record<string, number> = {};
    for (const [name, queue] of Object.entries(queues)) {
      depths[name] = await queue.getWaitingCount();
    }

    const maxDepth = Math.max(...Object.values(depths));

    return {
      status: maxDepth >= threshold ? 'degraded' : 'ok',
      value: depths,
      threshold,
      message:
        maxDepth >= threshold
          ? `Queue depth exceeded threshold: max ${maxDepth} waiting jobs`
          : `All queues healthy`,
    };
  }

  private async checkStellarLag(): Promise<CheckResult> {
    const horizonUrl = this.configService.get('STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org');
    const threshold = 10;

    const response = await firstValueFrom(
      this.httpService.get<any>(`${horizonUrl}/`, { timeout: 5000 }),
    );

    const latest: number = response.data?.history_latest_ledger ?? 0;
    const elder: number = response.data?.history_elder_ledger ?? 0;
    const lag = latest - elder;

    return {
      status: lag >= threshold ? 'degraded' : 'ok',
      value: { latestLedger: latest, lag },
      threshold,
      message:
        lag >= threshold
          ? `Stellar indexer lagging: ${lag} ledgers behind`
          : `Stellar indexer up to date (lag: ${lag})`,
    };
  }

  private async checkIpfs(): Promise<CheckResult> {
    const ipfsUrl = this.configService.get('IPFS_API_URL', 'http://localhost:5001');

    const response = await firstValueFrom(
      this.httpService.post<any>(`${ipfsUrl}/api/v0/version`, null, { timeout: 5000 }),
    );

    return {
      status: 'ok',
      value: { version: response.data?.Version },
      threshold: null,
      message: `IPFS node reachable (v${response.data?.Version})`,
    };
  }

  private errorResult(status: 'degraded' | 'down', error: any): CheckResult {
    return {
      status,
      value: null,
      threshold: null,
      message: error?.message ?? String(error),
    };
  }
}
