import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ReportGenerationService } from '../services/report-generation.service';
import { ReportBuilderService } from '../services/report-builder.service';
import { IpfsService } from '../services/ipfs.service';
import { EmailService } from '../services/email.service';
import { ReportFormat } from '../entities/report-job.entity';
import { QUEUE_NAMES } from '../../queues/queue.constants';
import * as path from 'path';
import * as fs from 'fs';

@Processor(QUEUE_NAMES.REPORTS)
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private reportGenerationService: ReportGenerationService,
    private reportBuilderService: ReportBuilderService,
    private ipfsService: IpfsService,
    private emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job) {
    const { jobId, patientId, format } = job.data;

    try {
      this.logger.log(`Processing report job: ${jobId}`);
      await this.reportGenerationService.markAsProcessing(jobId);

      const tempDir = path.join(process.cwd(), 'temp', 'reports');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const fileName = `report-${jobId}.${format}`;
      const filePath = path.join(tempDir, fileName);

      if (format === ReportFormat.PDF) {
        await this.reportBuilderService.generatePDF(patientId, filePath);
      } else {
        await this.reportBuilderService.generateCSV(patientId, filePath);
      }

      const ipfsHash = await this.ipfsService.uploadFile(filePath);

      fs.unlinkSync(filePath);

      await this.reportGenerationService.markAsCompleted(jobId, ipfsHash);

      // TODO: Get patient email from database
      // await this.emailService.sendReportReadyEmail(patientEmail, jobId, downloadToken);

      this.logger.log(`Report job completed: ${jobId}`);
    } catch (error) {
      this.logger.error(`Report job failed: ${jobId}`, error.stack);
      await this.reportGenerationService.markAsFailed(jobId, error.message);
      throw error;
    }
  }
}
