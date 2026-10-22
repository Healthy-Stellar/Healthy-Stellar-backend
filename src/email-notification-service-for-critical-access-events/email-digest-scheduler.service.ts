// src/queue/email-digest-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { EMAIL_DIGEST_QUEUE } from './email-queue.module';
import { MailService, DigestSummary } from './mail.service';
import { EmailLookupService } from './email-lookup.service';
import { EmailJobData, EmailJobType } from './email-queue.producer';

/**
 * Batches queued non-critical access-event emails into a single periodic
 * digest per patient. Interval is configurable via EMAIL_DIGEST_CRON (a
 * standard cron expression); defaults to every 30 minutes.
 */
@Injectable()
export class EmailDigestSchedulerService {
  private readonly logger = new Logger(EmailDigestSchedulerService.name);

  constructor(
    @InjectQueue(EMAIL_DIGEST_QUEUE) private readonly digestQueue: Queue,
    private readonly mailService: MailService,
    private readonly lookup: EmailLookupService,
  ) {}

  @Cron(process.env.EMAIL_DIGEST_CRON || CronExpression.EVERY_30_MINUTES)
  async handleDigest(): Promise<void> {
    const jobs: Job<EmailJobData>[] = await this.digestQueue.getJobs(['waiting', 'delayed']);
    if (!jobs.length) return;

    const jobsByPatient = new Map<string, Job<EmailJobData>[]>();
    for (const job of jobs) {
      const patientId = job.data.patientId;
      const existing = jobsByPatient.get(patientId) ?? [];
      existing.push(job);
      jobsByPatient.set(patientId, existing);
    }

    for (const [patientId, patientJobs] of jobsByPatient) {
      try {
        const summary = this.summarize(patientJobs);
        const patient = await this.lookup.findPatient(patientId);
        await this.mailService.sendDigestEmail(patient, summary);
        await Promise.all(patientJobs.map((job) => job.remove()));
      } catch (error) {
        this.logger.error(
          `Failed to send digest for patient ${patientId}: ${(error as Error).message}`,
        );
      }
    }
  }

  private summarize(jobs: Job<EmailJobData>[]): DigestSummary {
    const counts: Record<string, number> = {
      [EmailJobType.ACCESS_GRANTED]: 0,
      [EmailJobType.ACCESS_REVOKED]: 0,
      [EmailJobType.RECORD_UPLOADED]: 0,
    };

    for (const job of jobs) {
      counts[job.data.type] = (counts[job.data.type] ?? 0) + 1;
    }

    return {
      accessGrantedCount: counts[EmailJobType.ACCESS_GRANTED],
      accessRevokedCount: counts[EmailJobType.ACCESS_REVOKED],
      recordUploadedCount: counts[EmailJobType.RECORD_UPLOADED],
      totalEvents: jobs.length,
    };
  }
}
