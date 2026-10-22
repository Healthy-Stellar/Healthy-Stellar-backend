import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../queues/queue.constants';

@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  constructor(
    @InjectQueue(QUEUE_NAMES.STELLAR_TRANSACTIONS)
    private stellarQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL_NOTIFICATIONS)
    private emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.IPFS_UPLOADS)
    private ipfsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REPORTS)
    private reportsQueue: Queue,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const queues: [string, Queue][] = [
      [QUEUE_NAMES.STELLAR_TRANSACTIONS, this.stellarQueue],
      [QUEUE_NAMES.EMAIL_NOTIFICATIONS, this.emailQueue],
      [QUEUE_NAMES.IPFS_UPLOADS, this.ipfsQueue],
      [QUEUE_NAMES.REPORTS, this.reportsQueue],
    ];

    const details: Record<string, { waiting: number; active: number; failed: number }> = {};
    let healthy = true;

    for (const [name, queue] of queues) {
      try {
        const [waiting, active, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getFailedCount(),
        ]);
        details[name] = { waiting, active, failed };
      } catch {
        healthy = false;
        details[name] = { waiting: -1, active: -1, failed: -1 };
      }
    }

    if (!healthy) {
      throw new HealthCheckError(
        'Queue health check failed',
        this.getStatus(key, false, details),
      );
    }

    return this.getStatus(key, true, details);
  }
}
