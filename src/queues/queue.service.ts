import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JOB_STATUS } from './queue.constants';
import { StellarTransactionJobDto } from './dto/stellar-transaction-job.dto';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.STELLAR_TRANSACTIONS)
    private stellarQueue: Queue,
    @InjectQueue(QUEUE_NAMES.IPFS_UPLOADS)
    private ipfsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL_NOTIFICATIONS)
    private emailQueue: Queue,
  ) {}

  async dispatchStellarTransaction(
    jobData: StellarTransactionJobDto,
  ): Promise<string> {
    const job = await this.stellarQueue.add(
      jobData.operationType,
      jobData,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    this.logger.log(
      `Dispatched ${jobData.operationType} job ${job.id} (correlation: ${jobData.correlationId})`,
    );

    return jobData.correlationId;
  }

  async getJobStatus(correlationId: string): Promise<any> {
    const queues = [this.stellarQueue, this.ipfsQueue, this.emailQueue];

    for (const queue of queues) {
      const jobs = await queue.getJobs([
        'waiting',
        'active',
        'completed',
        'failed',
      ]);

      const job = jobs.find((j) => j.data.correlationId === correlationId);

      if (job) {
        const state = await job.getState();
        const progress = job.progress;
        const failedReason = job.failedReason;

        return {
          correlationId,
          jobId: job.id,
          status: this.mapJobState(state),
          progress,
          failedReason,
          data: job.data,
          returnValue: job.returnvalue,
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp,
        };
      }
    }

    throw new NotFoundException(
      `Job with correlationId ${correlationId} not found`,
    );
  }

  private mapJobState(state: string): string {
    const stateMap: Record<string, string> = {
      waiting: JOB_STATUS.QUEUED,
      active: JOB_STATUS.PROCESSING,
      completed: JOB_STATUS.COMPLETED,
      failed: JOB_STATUS.FAILED,
    };
    return stateMap[state] || state;
  }
}
