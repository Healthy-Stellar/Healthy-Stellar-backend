import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { QueueEvents } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QUEUE_NAMES } from './queue.constants';
import { createRedisRetryStrategy } from '../common/utils/connection-retry.util';

@Injectable()
export class QueueEventsListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueEventsListener.name);
  private listeners: QueueEvents[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    const connection = {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      retryStrategy: createRedisRetryStrategy(),
    };

    const queuesToListen = [
      QUEUE_NAMES.CONTRACT_WRITES,
      QUEUE_NAMES.STELLAR_TRANSACTIONS,
      QUEUE_NAMES.IPFS_UPLOADS,
      QUEUE_NAMES.EVENT_INDEXING,
      QUEUE_NAMES.EMAIL_NOTIFICATIONS,
      QUEUE_NAMES.REPORTS,
    ];

    for (const queueName of queuesToListen) {
      const queueEvents = new QueueEvents(queueName, { connection });

      queueEvents.on('active', ({ jobId }) => {
        this.eventEmitter.emit(`job.${jobId}.status`, { jobId, status: 'PROCESSING', type: 'active' });
      });

      queueEvents.on('completed', ({ jobId, returnvalue }) => {
        this.eventEmitter.emit(`job.${jobId}.status`, { jobId, status: 'COMPLETED', type: 'completed', result: returnvalue });
      });

      queueEvents.on('failed', ({ jobId, failedReason }) => {
        this.eventEmitter.emit(`job.${jobId}.status`, { jobId, status: 'FAILED', type: 'failed', error: failedReason });
      });

      queueEvents.on('progress', ({ jobId, data }) => {
        // BullMQ progress can be numeric or object, standardize it in the service layer if needed
        this.eventEmitter.emit(`job.${jobId}.status`, { jobId, status: 'PROCESSING', type: 'progress', progress: data });
      });

      queueEvents.on('error', (err) => {
        this.logger.error(`Error in QueueEvents for ${queueName}`, err);
      });

      this.listeners.push(queueEvents);
    }
  }

  async onModuleDestroy() {
    for (const listener of this.listeners) {
      await listener.close();
    }
  }
}
