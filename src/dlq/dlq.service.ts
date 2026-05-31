import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DlqJobEntity, DlqJobStatus } from './dlq-job.entity';
import { QUEUE_NAMES } from '../queues/queue.constants';

export interface DlqListOptions {
  queueName?: string;
  status?: DlqJobStatus;
  limit?: number;
  offset?: number;
}

export interface ReplayResult {
  dlqId: string;
  jobId: string;
  queueName: string;
  newBullJobId: string | undefined;
}

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  /** Map queue name → injected BullMQ Queue instance */
  private readonly queues: Map<string, Queue>;

  constructor(
    @InjectRepository(DlqJobEntity)
    private readonly repo: Repository<DlqJobEntity>,

    @InjectQueue(QUEUE_NAMES.STELLAR_TRANSACTIONS)
    private readonly stellarQueue: Queue,
    @InjectQueue(QUEUE_NAMES.CONTRACT_WRITES)
    private readonly contractWritesQueue: Queue,
    @InjectQueue(QUEUE_NAMES.IPFS_UPLOADS)
    private readonly ipfsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EVENT_INDEXING)
    private readonly eventIndexingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL_NOTIFICATIONS)
    private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REPORTS)
    private readonly reportsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EHR_IMPORT)
    private readonly ehrImportQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WEBHOOK_DELIVERY)
    private readonly webhookQueue: Queue,
  ) {
    this.queues = new Map([
      [QUEUE_NAMES.STELLAR_TRANSACTIONS, this.stellarQueue],
      [QUEUE_NAMES.CONTRACT_WRITES, this.contractWritesQueue],
      [QUEUE_NAMES.IPFS_UPLOADS, this.ipfsQueue],
      [QUEUE_NAMES.EVENT_INDEXING, this.eventIndexingQueue],
      [QUEUE_NAMES.EMAIL_NOTIFICATIONS, this.emailQueue],
      [QUEUE_NAMES.REPORTS, this.reportsQueue],
      [QUEUE_NAMES.EHR_IMPORT, this.ehrImportQueue],
      [QUEUE_NAMES.WEBHOOK_DELIVERY, this.webhookQueue],
    ]);
  }

  // ── Capture ──────────────────────────────────────────────────────────────

  /**
   * Called by the QueueEventsListener when a job exhausts all retries.
   * Persists the failed job to the dlq_jobs table.
   */
  async capture(params: {
    jobId: string;
    queueName: string;
    jobName: string;
    data: Record<string, any>;
    opts: Record<string, any>;
    failedReason: string;
    stackTrace?: string;
    attemptsMade: number;
  }): Promise<DlqJobEntity> {
    const entity = this.repo.create({
      jobId: params.jobId,
      queueName: params.queueName,
      jobName: params.jobName,
      data: params.data,
      opts: params.opts,
      failedReason: params.failedReason,
      stackTrace: params.stackTrace ?? null,
      attemptsMade: params.attemptsMade,
      status: DlqJobStatus.FAILED,
    });

    const saved = await this.repo.save(entity);
    this.logger.warn(`[DLQ] Captured failed job ${params.jobId} from queue=${params.queueName}`);
    return saved;
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  async list(opts: DlqListOptions = {}): Promise<{ items: DlqJobEntity[]; total: number }> {
    const where: FindManyOptions<DlqJobEntity>['where'] = {};
    if (opts.queueName) (where as any).queueName = opts.queueName;
    if (opts.status) (where as any).status = opts.status;

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { failedAt: 'DESC' },
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0,
    });

    return { items, total };
  }

  async findOne(id: string): Promise<DlqJobEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`DLQ job ${id} not found`);
    return entity;
  }

  // ── Replay ────────────────────────────────────────────────────────────────

  /**
   * Re-enqueue a single DLQ entry back into its original queue.
   */
  async replay(id: string, replayedBy: string): Promise<ReplayResult> {
    const entity = await this.findOne(id);

    if (entity.status === DlqJobStatus.DISCARDED) {
      throw new BadRequestException(`DLQ job ${id} has been discarded and cannot be replayed`);
    }

    const queue = this.queues.get(entity.queueName);
    if (!queue) {
      throw new BadRequestException(`No queue registered for '${entity.queueName}'`);
    }

    const newJob = await queue.add(entity.jobName, entity.data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    });

    await this.repo.update(id, {
      status: DlqJobStatus.REPLAYED,
      replayCount: entity.replayCount + 1,
      replayedBy,
    });

    this.logger.log(
      `[DLQ] Replayed job ${entity.jobId} → new BullMQ job ${newJob.id} (queue=${entity.queueName}, by=${replayedBy})`,
    );

    return {
      dlqId: id,
      jobId: entity.jobId,
      queueName: entity.queueName,
      newBullJobId: newJob.id,
    };
  }

  /**
   * Replay all failed entries for a given queue (or all queues if omitted).
   */
  async replayAll(queueName?: string, replayedBy = 'system'): Promise<ReplayResult[]> {
    const { items } = await this.list({
      queueName,
      status: DlqJobStatus.FAILED,
      limit: 500,
    });

    const results: ReplayResult[] = [];
    for (const item of items) {
      try {
        const result = await this.replay(item.id, replayedBy);
        results.push(result);
      } catch (err) {
        this.logger.error(`[DLQ] Failed to replay ${item.id}: ${(err as Error).message}`);
      }
    }

    return results;
  }

  // ── Discard ───────────────────────────────────────────────────────────────

  async discard(id: string, discardedBy: string): Promise<DlqJobEntity> {
    const entity = await this.findOne(id);
    await this.repo.update(id, {
      status: DlqJobStatus.DISCARDED,
      replayedBy: discardedBy,
    });
    this.logger.log(`[DLQ] Discarded job ${entity.jobId} by ${discardedBy}`);
    return { ...entity, status: DlqJobStatus.DISCARDED };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async stats(): Promise<Record<string, { failed: number; replayed: number; discarded: number }>> {
    const rows = await this.repo
      .createQueryBuilder('d')
      .select('d.queueName', 'queueName')
      .addSelect('d.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('d.queueName')
      .addGroupBy('d.status')
      .getRawMany<{ queueName: string; status: DlqJobStatus; count: string }>();

    const result: Record<string, { failed: number; replayed: number; discarded: number }> = {};
    for (const row of rows) {
      if (!result[row.queueName]) {
        result[row.queueName] = { failed: 0, replayed: 0, discarded: 0 };
      }
      result[row.queueName][row.status] = parseInt(row.count, 10);
    }
    return result;
  }
}
