import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { QueueEvents } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DlqService } from './dlq.service';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { createRedisRetryStrategy } from '../common/utils/connection-retry.util';

export const DLQ_PERMANENT_FAILURE_EVENT = 'dlq.job.permanent-failure';

export interface DlqPermanentFailurePayload {
  dlqEntityId: string;
  jobId: string;
  queueName: string;
  jobName: string;
  failedReason: string;
  attemptsMade: number;
  timestamp: string;
}

/**
 * Listens to BullMQ QueueEvents for every registered queue.
 * When a job exhausts all retries (the 'failed' event fires with
 * attemptsMade === opts.attempts), it is persisted to the dlq_jobs table
 * via DlqService.capture().
 */
@Injectable()
export class DlqCaptureListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DlqCaptureListener.name);
  private readonly queueEvents: QueueEvents[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly dlqService: DlqService,
    private readonly eventEmitter: EventEmitter2,

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
  ) {}

  private get queueMap(): Map<string, Queue> {
    return new Map([
      [QUEUE_NAMES.STELLAR_TRANSACTIONS, this.stellarQueue],
      [QUEUE_NAMES.CONTRACT_WRITES, this.contractWritesQueue],
      [QUEUE_NAMES.IPFS_UPLOADS, this.ipfsQueue],
      [QUEUE_NAMES.EVENT_INDEXING, this.eventIndexingQueue],
      [QUEUE_NAMES.EMAIL_NOTIFICATIONS, this.emailQueue],
      [QUEUE_NAMES.REPORTS, this.reportsQueue],
      [QUEUE_NAMES.EHR_IMPORT, this.ehrImportQueue],
    ]);
  }

  onModuleInit(): void {
    const connection = {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      retryStrategy: createRedisRetryStrategy(),
    };

    for (const [queueName, queue] of this.queueMap) {
      const events = new QueueEvents(queueName, { connection });

      events.on('failed', async ({ jobId, failedReason, prev }) => {
        try {
          const job = await queue.getJob(jobId);
          if (!job) return;

          const maxAttempts = job.opts?.attempts ?? 1;
          // Only capture when all retries are exhausted
          if (job.attemptsMade < maxAttempts) return;

          const reason = failedReason ?? job.failedReason ?? 'Unknown error';
          const saved = await this.dlqService.capture({
            jobId,
            queueName,
            jobName: job.name,
            data: job.data as Record<string, any>,
            opts: job.opts as Record<string, any>,
            failedReason: reason,
            stackTrace: job.stacktrace?.join('\n') ?? undefined,
            attemptsMade: job.attemptsMade,
          });

          const alertPayload: DlqPermanentFailurePayload = {
            dlqEntityId: saved.id,
            jobId,
            queueName,
            jobName: job.name,
            failedReason: reason,
            attemptsMade: job.attemptsMade,
            timestamp: new Date().toISOString(),
          };
          this.eventEmitter.emit(DLQ_PERMANENT_FAILURE_EVENT, alertPayload);
          this.logger.error(
            `[DLQ] Permanent failure alert: job=${jobId} queue=${queueName} reason="${reason}"`,
          );
        } catch (err) {
          this.logger.error(
            `[DLQ] Error capturing failed job ${jobId} from ${queueName}: ${(err as Error).message}`,
          );
        }
      });

      events.on('error', (err) => {
        this.logger.error(`[DLQ] QueueEvents error for ${queueName}`, err);
      });

      this.queueEvents.push(events);
    }

    this.logger.log(`[DLQ] Capture listener active for ${this.queueMap.size} queues`);
  }

  async onModuleDestroy(): Promise<void> {
    for (const events of this.queueEvents) {
      await events.close();
    }
  }
}
