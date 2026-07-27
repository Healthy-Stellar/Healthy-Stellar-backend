import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { firstValueFrom } from 'rxjs';
import { QUEUE_NAMES } from '../../queues/queue.constants';

export interface DetailedCheckResult {
  status: 'up' | 'degraded' | 'down';
  value: unknown;
  threshold: unknown;
  message: string;
}

export interface DetailedHealthResult {
  status: 'up' | 'degraded' | 'down';
  checks: Record<string, DetailedCheckResult>;
}

@Injectable()
export class DetailedHealthIndicator extends HealthIndicator {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectQueue(QUEUE_NAMES.STELLAR_TRANSACTIONS) private stellarQueue: Queue,
    @InjectQueue(QUEUE_NAMES.IPFS_UPLOADS) private ipfsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL_NOTIFICATIONS) private emailQueue: Queue,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    super();
  }

  async checkDbPool(): Promise<DetailedCheckResult> {
    try {
      const driver = this.dataSource.driver as any;
      const pool = driver?.master ?? driver?.pool;
      const active: number = pool?._allConnections?.length ?? pool?.totalCount ?? 0;
      const idle: number = pool?._freeConnections?.length ?? pool?.idleCount ?? 0;
      const waiting: number = pool?._connectionQueue?.length ?? pool?.waitingCount ?? 0;
      const threshold = this.configService.get<number>('DB_POOL_MAX', 10);

      return {
        status: active >= threshold ? 'degraded' : 'up',
        value: { active, idle, waiting },
        threshold,
        message:
          active >= threshold
            ? `Connection pool saturated (${active}/${threshold})`
            : `Pool healthy (${active} active, ${idle} idle, ${waiting} waiting)`,
      };
    } catch {
      return { status: 'down', value: null, threshold: null, message: 'Failed to read DB pool stats' };
    }
  }

  async checkRedisMemory(): Promise<DetailedCheckResult> {
    const threshold = this.configService.get<number>('REDIS_MEMORY_THRESHOLD_MB', 512);
    try {
      const Redis = require('ioredis');
      const redis = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get('REDIS_PASSWORD'),
        lazyConnect: true,
        connectTimeout: 5000,
      });
      await redis.connect();
      const info: string = await redis.info('memory');
      await redis.quit();

      const match = info.match(/used_memory:(\d+)/);
      const usedBytes = match ? parseInt(match[1], 10) : 0;
      const usedMb = Math.round(usedBytes / 1024 / 1024);

      return {
        status: usedMb >= threshold ? 'degraded' : 'up',
        value: `${usedMb}MB`,
        threshold: `${threshold}MB`,
        message:
          usedMb >= threshold
            ? `Redis memory usage high: ${usedMb}MB / ${threshold}MB threshold`
            : `Redis memory usage normal: ${usedMb}MB`,
      };
    } catch (err: any) {
      return { status: 'degraded', value: null, threshold: `${threshold}MB`, message: `Redis unreachable: ${err.message}` };
    }
  }

  async checkQueueDepths(): Promise<DetailedCheckResult> {
    const threshold = this.configService.get<number>('QUEUE_DEPTH_THRESHOLD', 100);
    try {
      const [stellarWaiting, ipfsWaiting, emailWaiting] = await Promise.all([
        this.stellarQueue.getWaitingCount(),
        this.ipfsQueue.getWaitingCount(),
        this.emailQueue.getWaitingCount(),
      ]);

      const depths = {
        [QUEUE_NAMES.STELLAR_TRANSACTIONS]: stellarWaiting,
        [QUEUE_NAMES.IPFS_UPLOADS]: ipfsWaiting,
        [QUEUE_NAMES.EMAIL_NOTIFICATIONS]: emailWaiting,
      };

      const maxDepth = Math.max(stellarWaiting, ipfsWaiting, emailWaiting);

      return {
        status: maxDepth >= threshold ? 'degraded' : 'up',
        value: depths,
        threshold,
        message:
          maxDepth >= threshold
            ? `Queue backlog detected, max depth: ${maxDepth}`
            : `All queues within normal depth`,
      };
    } catch (err: any) {
      return { status: 'degraded', value: null, threshold, message: `Queue check failed: ${err.message}` };
    }
  }

  async checkBlockchainLag(): Promise<DetailedCheckResult> {
    const threshold = this.configService.get<number>('BLOCKCHAIN_LAG_THRESHOLD', 10);
    const horizonUrl = this.configService.get('STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org');
    try {
      const response = await firstValueFrom(
        this.httpService.get<any>(`${horizonUrl}/`, { timeout: 5000 }),
      );
      const latestLedger: number = response.data?.core_latest_ledger ?? 0;
      const historyLedger: number = response.data?.history_latest_ledger ?? 0;
      const lag = latestLedger - historyLedger;

      return {
        status: lag >= threshold ? 'degraded' : 'up',
        value: { latestLedger, historyLedger, lag },
        threshold,
        message:
          lag >= threshold
            ? `Blockchain indexer lagging by ${lag} ledgers`
            : `Blockchain indexer in sync (lag: ${lag})`,
      };
    } catch (err: any) {
      return { status: 'degraded', value: null, threshold, message: `Stellar Horizon unreachable: ${err.message}` };
    }
  }

  async checkIpfsConnectivity(): Promise<DetailedCheckResult> {
    const ipfsUrl = this.configService.get('IPFS_API_URL', 'http://localhost:5001');
    try {
      const response = await firstValueFrom(
        this.httpService.post<any>(`${ipfsUrl}/api/v0/version`, null, { timeout: 5000 }),
      );
      const version: string = response.data?.Version ?? 'unknown';
      return {
        status: 'up',
        value: { version },
        threshold: null,
        message: `IPFS node reachable (version: ${version})`,
      };
    } catch (err: any) {
      return { status: 'degraded', value: null, threshold: null, message: `IPFS node unreachable: ${err.message}` };
    }
  }

  async getDetailedHealth(): Promise<HealthIndicatorResult> {
    const [db, redis, queues, blockchain, ipfs] = await Promise.all([
      this.checkDbPool(),
      this.checkRedisMemory(),
      this.checkQueueDepths(),
      this.checkBlockchainLag(),
      this.checkIpfsConnectivity(),
    ]);

    const checks = { db, redis, queues, blockchain, ipfs };

    const isDown = db.status === 'down';
    const isDegraded = Object.values(checks).some((c) => c.status !== 'up');
    const overallStatus: 'up' | 'degraded' | 'down' = isDown ? 'down' : isDegraded ? 'degraded' : 'up';

    const result = this.getStatus('detailed', overallStatus === 'up', { overallStatus, checks });

    if (overallStatus === 'down') {
      throw new HealthCheckError('Critical dependency down', result);
    }

    return result;
  }
}
