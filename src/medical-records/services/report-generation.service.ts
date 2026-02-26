import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ReportJob, ReportStatus, ReportFormat } from '../entities/report-job.entity';
import { QUEUE_NAMES } from '../../queues/queue.constants';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ReportGenerationService {
  private readonly logger = new Logger(ReportGenerationService.name);

  constructor(
    @InjectRepository(ReportJob)
    private reportJobRepository: Repository<ReportJob>,
    @InjectQueue(QUEUE_NAMES.REPORTS) private reportQueue: Queue,
  ) {}

  async queueReportGeneration(patientId: string, format: ReportFormat) {
    const job = this.reportJobRepository.create({
      patientId,
      format,
      status: ReportStatus.PENDING,
      downloadToken: uuidv4(),
      estimatedTime: format === ReportFormat.PDF ? 60 : 30,
    });

    await this.reportJobRepository.save(job);

    await this.reportQueue.add('generate-report', {
      jobId: job.id,
      patientId,
      format,
    });

    this.logger.log(`Report generation queued: ${job.id}`);

    return {
      jobId: job.id,
      estimatedTime: job.estimatedTime,
    };
  }

  async getJobStatus(jobId: string) {
    const job = await this.reportJobRepository.findOne({ where: { id: jobId } });
    
    if (!job) {
      return null;
    }

    return {
      jobId: job.id,
      status: job.status,
      downloadUrl: job.status === ReportStatus.COMPLETED ? `/reports/${jobId}/download?token=${job.downloadToken}` : null,
      ipfsHash: job.ipfsHash,
      expiresAt: job.expiresAt,
      errorMessage: job.errorMessage,
    };
  }

  async markAsProcessing(jobId: string) {
    await this.reportJobRepository.update(jobId, { status: ReportStatus.PROCESSING });
  }

  async markAsCompleted(jobId: string, ipfsHash: string) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    await this.reportJobRepository.update(jobId, {
      status: ReportStatus.COMPLETED,
      ipfsHash,
      expiresAt,
    });
  }

  async markAsFailed(jobId: string, errorMessage: string) {
    await this.reportJobRepository.update(jobId, {
      status: ReportStatus.FAILED,
      errorMessage,
    });
  }

  async validateDownload(jobId: string, token: string) {
    const job = await this.reportJobRepository.findOne({ where: { id: jobId } });

    if (!job || job.downloadToken !== token) {
      return null;
    }

    if (job.downloaded) {
      return { error: 'Link already used' };
    }

    if (job.expiresAt && job.expiresAt < new Date()) {
      return { error: 'Link expired' };
    }

    await this.reportJobRepository.update(jobId, { downloaded: true });

    return job;
  }
}

