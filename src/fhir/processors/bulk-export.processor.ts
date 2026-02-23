import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BulkExportService } from '../services/bulk-export.service';

@Processor('fhir-bulk-export')
export class BulkExportProcessor extends WorkerHost {
  constructor(private readonly exportService: BulkExportService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { jobId } = job.data;
    await this.exportService.processExport(jobId);
  }
}
