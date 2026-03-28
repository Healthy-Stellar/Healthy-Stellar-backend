import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { context, propagation, trace } from '@opentelemetry/api';
import { QUEUE_NAMES, JOB_STATUS } from './queue.constants';
import { StellarTransactionJobDto } from './dto/stellar-transaction-job.dto';
import { TracingService } from '../common/services/tracing.service';

interface JobDispatchResult {
  jobId: string;
  correlationId: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly tracer = trace.getTracer('healthy-stellar-backend');

  constructor(
    @InjectQueue(QUEUE_NAMES.STELLAR_TRANSACTIONS)
    private stellarQueue: Queue,
    @InjectQueue(QUEUE_NAMES.CONTRACT_WRITES)
    private contractWritesQueue: Queue,
    @InjectQueue(QUEUE_NAMES.IPFS_UPLOADS)
    private ipfsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EVENT_INDEXING)
    private eventIndexingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL_NOTIFICATIONS)
    private emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REPORTS)
    private reportsQueue: Queue,
    private readonly tracingService: TracingService,
  ) {}

  /**
   * Dispatch Soroban contract write operation to background queue
   */
  async dispatchContractWrite(
    jobData: StellarTransactionJobDto,
  ): Promise<JobDispatchResult> {
    return this.tracingService.withSpan('queue.dispatch.contractWrite', async (span) => {
      span.setAttribute('queue.name', QUEUE_NAMES.CONTRACT_WRITES);
      span.setAttribute('queue.operation_type', jobData.operationType);
      span.setAttribute('queue.correlation_id', jobData.correlationId);

      // Extract and enrich trace context
      const traceContext: Record<string, string> = {};
      propagation.inject(context.active(), traceContext);

      const enrichedJobData = {
        ...jobData,
        traceContext,
        traceId: this.tracingService.getCurrentTraceId(),
      };

      const job = await this.contractWritesQueue.add(
        jobData.operationType,
        enrichedJobData,
        {
          jobId: jobData.correlationId,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );

      span.setAttribute('queue.job_id', job.id || 'unknown');
      this.tracingService.addEvent('queue.job.dispatched', {
        'queue.job_id': job.id,
        'queue.queue_name': QUEUE_NAMES.CONTRACT_WRITES,
        'queue.correlation_id': jobData.correlationId,
      });

      this.logger.log(
        `Dispatched contract write job - jobId: ${job.id}, operationType: ${jobData.operationType}, correlation: ${jobData.correlationId}`,
      );

      return {
        jobId: job.id!,
        correlationId: jobData.correlationId,
      };
    });
  }

  /**
   * Dispatch Stellar transaction to background queue
   */
  async dispatchStellarTransaction(
    jobData: StellarTransactionJobDto,
  ): Promise<JobDispatchResult> {
    return this.tracingService.withSpan(
      'queue.dispatch.stellarTransaction',
      async (span) => {
        span.setAttribute('queue.name', QUEUE_NAMES.STELLAR_TRANSACTIONS);
        span.setAttribute('queue.operation_type', jobData.operationType);
        span.setAttribute('queue.correlation_id', jobData.correlationId);

        // Extract trace context for propagation
        const traceContext: Record<string, string> = {};
        propagation.inject(context.active(), traceContext);

        // Add trace context to job data
        const enrichedJobData = {
          ...jobData,
          traceContext,
          traceId: this.tracingService.getCurrentTraceId(),
        };

        const job = await this.stellarQueue.add(
          jobData.operationType,
          enrichedJobData,
          {
            jobId: jobData.correlationId,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: true,
            removeOnFail: true,
          },
        );

        span.setAttribute('queue.job_id', job.id || 'unknown');
        this.tracingService.addEvent('queue.job.dispatched', {
          'queue.job_id': job.id,
          'queue.correlation_id': jobData.correlationId,
        });

        this.logger.log(
          `Dispatched ${jobData.operationType} job ${job.id} (correlation: ${jobData.correlationId})`,
        );

        return {
          jobId: job.id!,
          correlationId: jobData.correlationId,
        };
      },
    );
  }

  /**
   * Dispatch IPFS upload to background queue
   */
  async dispatchIpfsUpload(jobData: any): Promise<JobDispatchResult> {
    return this.tracingService.withSpan('queue.dispatch.ipfsUpload', async (span) => {
      span.setAttribute('queue.name', QUEUE_NAMES.IPFS_UPLOADS);
      span.setAttribute('queue.correlation_id', jobData.correlationId);

      const traceContext: Record<string, string> = {};
      propagation.inject(context.active(), traceContext);

      const enrichedJobData = {
        ...jobData,
        traceContext,
        traceId: this.tracingService.getCurrentTraceId(),
      };

      const job = await this.ipfsQueue.add('upload', enrichedJobData, {
        jobId: jobData.correlationId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: true,
      });

      span.setAttribute('queue.job_id', job.id || 'unknown');
      this.logger.log(
        `Dispatched IPFS upload job ${job.id} (correlation: ${jobData.correlationId})`,
      );

      return {
        jobId: job.id!,
        correlationId: jobData.correlationId,
      };
    });
  }

  /**
   * Dispatch event indexing job to background queue
   */
  async dispatchEventIndexing(jobData: any): Promise<JobDispatchResult> {
    return this.tracingService.withSpan(
      'queue.dispatch.eventIndexing',
      async (span) => {
        span.setAttribute('queue.name', QUEUE_NAMES.EVENT_INDEXING);
        span.setAttribute('queue.correlation_id', jobData.correlationId);

        const traceContext: Record<string, string> = {};
        propagation.inject(context.active(), traceContext);

        const enrichedJobData = {
          ...jobData,
          traceContext,
          traceId: this.tracingService.getCurrentTraceId(),
        };

        const job = await this.eventIndexingQueue.add(
          'indexEvent',
          enrichedJobData,
          {
            jobId: jobData.correlationId,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: true,
            removeOnFail: true,
          },
        );

        span.setAttribute('queue.job_id', job.id || 'unknown');
        this.logger.log(
          `Dispatched event indexing job ${job.id} (correlation: ${jobData.correlationId})`,
        );

        return {
          jobId: job.id!,
          correlationId: jobData.correlationId,
        };
      },
    );
  }

  /**
   * Get job status by job ID
   */
  async getJobStatusById(jobId: string): Promise<any> {
    const queues = [
      this.contractWritesQueue,
      this.stellarQueue,
      this.ipfsQueue,
      this.eventIndexingQueue,
      this.emailQueue,
      this.reportsQueue,
    ];

    for (const queue of queues) {
      try {
        const job = await queue.getJob(jobId);
        if (job) {
          return this.buildJobStatusResponse(job);
        }
      } catch (error) {
        this.logger.debug(
          `Job ${jobId} not found in queue ${queue.name}`,
        );
      }
    }

    throw new NotFoundException(
      `Job with ID ${jobId} not found in any queue`,
    );
  }

  /**
   * Get job status by correlation ID (legacy support)
   */
  async getJobStatus(correlationId: string): Promise<any> {
    const queues = [
      this.contractWritesQueue,
      this.stellarQueue,
      this.ipfsQueue,
      this.eventIndexingQueue,
      this.emailQueue,
      this.reportsQueue,
    ];

    for (const queue of queues) {
      try {
        const jobs = await queue.getJobs([
          'waiting',
          'active',
          'completed',
          'failed',
        ]);

        const job = jobs.find(
          (j) => j.data.correlationId === correlationId,
        );

        if (job) {
          return this.buildJobStatusResponse(job);
        }
      } catch (error) {
        this.logger.debug(
          `Error searching jobs in queue ${queue.name}: ${(error as Error).message}`,
        );
      }
    }

    throw new NotFoundException(
      `Job with correlation ID ${correlationId} not found`,
    );
  }

  /**
   * Build normalized job status response
   */
  private buildJobStatusResponse(job: Job): any {
    const state = job._state;
    const progress = job._progress || 0;
    const failedReason = job.failedReason;

    return {
      jobId: job.id,
      correlationId: job.data.correlationId,
      status: this.mapJobState(state),
      progress: typeof progress === 'number' ? progress : 0,
      attempts: job.attemptsMade,
      error: failedReason || null,
      result: job.returnvalue || null,
      createdAt: new Date(job.timestamp).toISOString(),
      startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      completedAt: job.finishedOn
        ? new Date(job.finishedOn).toISOString()
        : null,
    };
  }

  /**
   * Map internal BullMQ job state to public status
   */
  private mapJobState(state: string): string {
    const stateMap: Record<string, string> = {
      waiting: JOB_STATUS.PENDING,
      paused: JOB_STATUS.PENDING,
      active: JOB_STATUS.PROCESSING,
      completed: JOB_STATUS.COMPLETED,
      failed: JOB_STATUS.FAILED,
      delayed: JOB_STATUS.PENDING,
    };
    return stateMap[state] || state.toUpperCase();
  }
}
