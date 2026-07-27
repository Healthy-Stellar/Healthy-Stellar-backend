import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Interval } from '@nestjs/schedule';
import { CustomMetricsService } from '../custom-metrics.service';
import { QUEUE_NAMES } from '../../queues/queue.constants';

const POLL_INTERVAL_MS = 15_000; // 15 s

@Injectable()
export class QueueMetricsCollector implements OnModuleInit {
  private readonly logger = new Logger(QueueMetricsCollector.name);

  constructor(
    private readonly metrics: CustomMetricsService,
    @InjectQueue(QUEUE_NAMES.STELLAR_TRANSACTIONS) private readonly stellarQueue: Queue,
    @InjectQueue(QUEUE_NAMES.IPFS_UPLOADS) private readonly ipfsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL_NOTIFICATIONS) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REPORTS) private readonly reportsQueue: Queue,
  ) {}

  async onModuleInit() {
    // Collect once immediately on startup
    await this.collectQueueDepths();
  }

  @Interval(POLL_INTERVAL_MS)
  async collectQueueDepths() {
    const queues: [string, Queue][] = [
      [QUEUE_NAMES.STELLAR_TRANSACTIONS, this.stellarQueue],
      [QUEUE_NAMES.IPFS_UPLOADS, this.ipfsQueue],
      [QUEUE_NAMES.EMAIL_NOTIFICATIONS, this.emailQueue],
      [QUEUE_NAMES.REPORTS, this.reportsQueue],
    ];

    for (const [name, queue] of queues) {
      try {
        const waiting = await queue.getWaitingCount();
        this.metrics.setQueueDepth(name, waiting);
      } catch (err) {
        this.logger.warn(`Failed to collect depth for queue "${name}": ${(err as Error).message}`);
      }
    }
  }
}
