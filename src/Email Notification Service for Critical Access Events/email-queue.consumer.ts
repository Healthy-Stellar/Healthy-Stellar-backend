// src/queue/email-queue.consumer.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EMAIL_QUEUE } from './email-queue.module';
import { MailService } from '../mail/mail.service';
import {
  EmailJobData,
  EmailJobType,
  AccessGrantedJobData,
  AccessRevokedJobData,
  RecordUploadedJobData,
  SuspiciousAccessJobData,
} from './email-queue.producer';

@Processor(EMAIL_QUEUE, {
  concurrency: 5,
})
export class EmailQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(EmailQueueConsumer.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    this.logger.log(`Processing job ${job.id} [${job.name}] attempt ${job.attemptsMade + 1}`);

    switch (job.data.type) {
      case EmailJobType.ACCESS_GRANTED: {
        const { patient, grantee, record } = job.data as AccessGrantedJobData;
        await this.mailService.sendAccessGrantedEmail(patient, grantee, record);
        break;
      }

      case EmailJobType.ACCESS_REVOKED: {
        const { patient, revokee, record } = job.data as AccessRevokedJobData;
        await this.mailService.sendAccessRevokedEmail(patient, revokee, record);
        break;
      }

      case EmailJobType.RECORD_UPLOADED: {
        const { patient, record, uploadedBy } = job.data as RecordUploadedJobData;
        await this.mailService.sendRecordUploadedEmail(patient, record, uploadedBy);
        break;
      }

      case EmailJobType.SUSPICIOUS_ACCESS: {
        const { patient, event } = job.data as SuspiciousAccessJobData;
        await this.mailService.sendSuspiciousAccessEmail(patient, event);
        break;
      }

      default:
        this.logger.warn(`Unknown job type: ${(job.data as any).type}`);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`Job ${job.id} [${job.name}] completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    const willRetry = job.attemptsMade < (job.opts.attempts ?? 3);
    this.logger.error(
      `Job ${job.id} [${job.name}] failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${error.message}`,
      willRetry ? 'Will retry with exponential backoff' : 'Max attempts reached',
    );
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(`Job ${jobId} stalled — will be re-queued`);
  }
}
