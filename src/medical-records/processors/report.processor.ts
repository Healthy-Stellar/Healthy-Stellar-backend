import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportGenerationService } from '../services/report-generation.service';
import { ReportBuilderService } from '../services/report-builder.service';
import { IpfsService } from '../services/ipfs.service';
import { EmailService } from '../services/email.service';
import { ReportFormat } from '../entities/report-job.entity';
import { QUEUE_NAMES } from '../../queues/queue.constants';
import { Patient } from '../../patients/entities/patient.entity';
import * as path from 'path';
import * as fs from 'fs';

/**
 * ReportProcessor
 *
 * Throttling strategy to prevent CPU/memory starvation of other queues:
 *
 *  concurrency: 1
 *    Only one report builds at a time per worker instance.
 *    PDF/CSV generation is CPU-bound; running multiple in parallel would
 *    spike CPU and RSS, starving stellar-transactions and contract-writes.
 *
 *  limiter: 2 jobs per 10 s
 *    Even if multiple worker replicas are running, the shared Redis-backed
 *    rate limiter caps total throughput to 2 reports/10 s cluster-wide.
 *    This keeps the reports queue from monopolising Redis I/O.
 *
 *  maxStalledCount: 2
 *    BullMQ will re-queue a stalled job up to 2 times before marking it
 *    failed, giving the DLQ capture listener a chance to record it.
 */
@Injectable()
@Processor(QUEUE_NAMES.REPORTS, {
  concurrency: 1,
  limiter: {
    max: 2,
    duration: 10_000, // 2 jobs per 10 seconds across all workers
  },
  settings: {
    maxStalledCount: 2,
  },
})
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private readonly reportGenerationService: ReportGenerationService,
    private readonly reportBuilderService: ReportBuilderService,
    private readonly ipfsService: IpfsService,
    private readonly emailService: EmailService,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { jobId, patientId, format } = job.data;

    // Memory guard: if RSS > 85 % of available memory, pause this worker and
    // re-queue the job so a less-loaded replica can pick it up.
    const memUsage = process.memoryUsage();
    const rssMb = memUsage.rss / 1024 / 1024;
    const heapTotalMb = memUsage.heapTotal / 1024 / 1024;
    const RSS_LIMIT_MB = parseInt(process.env.REPORT_WORKER_RSS_LIMIT_MB || '512', 10);

    if (rssMb > RSS_LIMIT_MB) {
      this.logger.warn(
        `[reports] Memory pressure detected — RSS=${rssMb.toFixed(0)} MB > limit=${RSS_LIMIT_MB} MB. ` +
        `Re-queuing job ${jobId} with 30 s delay.`,
      );
      // Move back to waiting with a delay so another worker can pick it up
      await job.moveToDelayed(Date.now() + 30_000);
      return;
    }

    this.logger.log(
      `[reports] Processing job=${jobId} format=${format} attempt=${job.attemptsMade + 1} ` +
      `rss=${rssMb.toFixed(0)}MB heap=${heapTotalMb.toFixed(0)}MB`,
    );

    try {
      this.logger.log(`Processing report job: ${jobId}`);
      await this.reportGenerationService.markAsProcessing(jobId);

      const tempDir = path.join(process.cwd(), 'temp', 'reports');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const fileName = `report-${jobId}.${format}`;
      const filePath = path.join(tempDir, fileName);

      await job.updateProgress(20);

      if (format === ReportFormat.PDF) {
        await this.reportBuilderService.generatePDF(patientId, filePath);
      } else {
        await this.reportBuilderService.generateCSV(patientId, filePath);
      }

      await job.updateProgress(60);

      const ipfsHash = await this.ipfsService.uploadFile(filePath);
      fs.unlinkSync(filePath);

      await job.updateProgress(80);

      await this.reportGenerationService.markAsCompleted(jobId, ipfsHash);

      // Fetch the completed job to get the download token, then email the patient.
      const completedJob = await this.reportGenerationService.getJobStatus(jobId);
      if (completedJob?.downloadUrl) {
        const patient = await this.patientRepository.findOne({ where: { id: patientId } });
        if (patient?.email) {
          // Extract the token from the download URL query string.
          const tokenMatch = completedJob.downloadUrl.match(/[?&]token=([^&]+)/);
          const downloadToken = tokenMatch ? tokenMatch[1] : '';
          await this.emailService.sendReportReadyEmail(patient.email, jobId, downloadToken);
        } else {
          this.logger.warn(
            `Report job ${jobId} completed but patient ${patientId} has no email address — skipping notification`,
          );
        }
      }

      await job.updateProgress(100);
      this.logger.log(`Report job completed: ${jobId}`);
    } catch (error) {
      this.logger.error(`Report job failed: ${jobId}`, error.stack);
      await this.reportGenerationService.markAsFailed(jobId, error.message);
      throw error;
    }
  }
}
