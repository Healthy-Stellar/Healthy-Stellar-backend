// src/queue/email-queue.consumer.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EMAIL_QUEUE } from './email-queue.module';
import { MailService } from './mail.service';
import { EmailLookupService } from './email-lookup.service';
import {
  EmailJobData,
  EmailJobType,
} from './email-queue.producer';

@Processor(EMAIL_QUEUE, { concurrency: 5 })
export class EmailQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(EmailQueueConsumer.name);

  constructor(
    private readonly mailService: MailService,
    private readonly lookup: EmailLookupService,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    this.logger.log(`Processing job ${job.id} [${job.name}] attempt ${job.attemptsMade + 1}`);

    switch (job.data.type) {
      case EmailJobType.ACCESS_GRANTED: {
        const { patientId, granteeId, recordId } = job.data;
        const [patient, grantee, record] = await Promise.all([
          this.lookup.findPatient(patientId),
          this.lookup.findProvider(granteeId),
          this.lookup.findRecord(recordId),
        ]);
        await this.mailService.sendAccessGrantedEmail(patient, grantee, record);
        break;
      }

      case EmailJobType.ACCESS_REVOKED: {
        const { patientId, revokeeId, recordId } = job.data;
        const [patient, revokee, record] = await Promise.all([
          this.lookup.findPatient(patientId),
          this.lookup.findProvider(revokeeId),
          this.lookup.findRecord(recordId),
        ]);
        await this.mailService.sendAccessRevokedEmail(patient, revokee, record);
        break;
      }

      case EmailJobType.RECORD_UPLOADED: {
        const { patientId, recordId, uploadedById } = job.data;
        const [patient, record, uploadedBy] = await Promise.all([
          this.lookup.findPatient(patientId),
          this.lookup.findRecord(recordId),
          uploadedById ? this.lookup.findProvider(uploadedById) : Promise.resolve(undefined),
        ]);
        await this.mailService.sendRecordUploadedEmail(patient, record, uploadedBy);
        break;
      }

      case EmailJobType.SUSPICIOUS_ACCESS: {
        const { patientId, accessEventId } = job.data;
        const [patient, event] = await Promise.all([
          this.lookup.findPatient(patientId),
          this.lookup.findAccessEvent(accessEventId),
        ]);
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
