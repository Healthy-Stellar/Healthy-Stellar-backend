import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../queues/queue.constants';
import { ComplianceReportsService } from '../services/compliance-reports.service';

@Processor(QUEUE_NAMES.COMPLIANCE_REPORTS)
export class ComplianceReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ComplianceReportProcessor.name);

  constructor(private readonly complianceReportsService: ComplianceReportsService) {
    super();
  }

  async process(job: Job<{ jobId: string }>): Promise<void> {
    this.logger.debug(`Processing compliance report job: ${job.data.jobId}`);
    await this.complianceReportsService.process(job.data.jobId);
  }
}
