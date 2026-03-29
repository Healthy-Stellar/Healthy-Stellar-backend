import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BulkExportJob, ExportJobStatus } from '../entities/bulk-export-job.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';
import { MedicalRecordConsent } from '../../medical-records/entities/medical-record-consent.entity';
import { MedicalHistory } from '../../medical-records/entities/medical-history.entity';
import { FhirMapper } from '../mappers/fhir.mapper';

const BATCH_SIZE = parseInt(process.env.BULK_EXPORT_BATCH_SIZE ?? '500', 10);

@Injectable()
export class BulkExportService {
  constructor(
    @InjectRepository(BulkExportJob) private jobRepo: Repository<BulkExportJob>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(MedicalRecord) private recordRepo: Repository<MedicalRecord>,
    @InjectRepository(MedicalRecordConsent) private consentRepo: Repository<MedicalRecordConsent>,
    @InjectRepository(MedicalHistory) private historyRepo: Repository<MedicalHistory>,
    @InjectQueue('fhir-bulk-export') private exportQueue: Queue,
  ) {}

  async initiateExport(
    requesterId: string,
    requesterRole: string,
    resourceTypes?: string[],
  ): Promise<string> {
    const types = resourceTypes || ['Patient', 'DocumentReference', 'Consent', 'Provenance'];
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const job = this.jobRepo.create({
      requesterId,
      requesterRole,
      resourceTypes: types,
      status: ExportJobStatus.PENDING,
      expiresAt,
    });

    await this.jobRepo.save(job);
    await this.exportQueue.add('process-export', { jobId: job.id });

    return job.id;
  }

  async getJobStatus(jobId: string, requesterId: string, requesterRole: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Export job not found');

    if (job.requesterId !== requesterId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('Access denied');
    }

    if (job.status === ExportJobStatus.COMPLETED) {
      return {
        transactionTime: job.updatedAt.toISOString(),
        request: `/fhir/r4/Patient/$export?_type=${job.resourceTypes.join(',')}`,
        requiresAccessToken: true,
        output: job.outputFiles || [],
      };
    }

    return { status: job.status, progress: job.progress, totalResources: job.totalResources };
  }

  async cancelJob(jobId: string, requesterId: string, requesterRole: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Export job not found');

    if (job.requesterId !== requesterId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('Access denied');
    }

    if (job.status === ExportJobStatus.IN_PROGRESS || job.status === ExportJobStatus.PENDING) {
      job.status = ExportJobStatus.CANCELLED;
      await this.jobRepo.save(job);
    }
  }

  async processExport(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job || job.status === ExportJobStatus.CANCELLED) return;

    job.status = ExportJobStatus.IN_PROGRESS;
    await this.jobRepo.save(job);

    try {
      const outputFiles = [];
      const isAdmin = job.requesterRole === 'ADMIN';

      for (const type of job.resourceTypes) {
        const { url, count } = await this.exportResourceType(type, job.requesterId, isAdmin, job);
        outputFiles.push({ type, url, count });
      }

      job.status = ExportJobStatus.COMPLETED;
      job.outputFiles = outputFiles;
      job.progress = 100;
      await this.jobRepo.save(job);
    } catch (error) {
      job.status = ExportJobStatus.FAILED;
      job.error = error.message;
      await this.jobRepo.save(job);
    }
  }

  private async exportResourceType(
    type: string,
    requesterId: string,
    isAdmin: boolean,
    job: BulkExportJob,
  ): Promise<{ url: string; count: number }> {
    const chunks: string[] = [];
    let count = 0;

    const append = async (lines: string[]) => {
      if (!lines.length) return;
      chunks.push(lines.join('\n'));
      count += lines.length;
      job.totalResources += lines.length;
      await this.jobRepo.save(job);
    };

    if (type === 'Patient') {
      await this.paginate(
        (skip, take) =>
          isAdmin
            ? this.patientRepo.find({ skip, take, order: { id: 'ASC' } })
            : this.patientRepo.find({ where: { id: requesterId }, skip, take }),
        async (batch) => append(batch.map((p) => JSON.stringify(FhirMapper.toPatient(p)))),
      );
    } else if (type === 'DocumentReference') {
      await this.paginate(
        (skip, take) =>
          isAdmin
            ? this.recordRepo.find({ skip, take, order: { id: 'ASC' } })
            : this.recordRepo.find({ where: { patientId: requesterId }, skip, take, order: { id: 'ASC' } }),
        async (batch) => append(batch.map((r) => JSON.stringify(FhirMapper.toDocumentReference(r)))),
      );
    } else if (type === 'Consent') {
      await this.paginate(
        (skip, take) =>
          isAdmin
            ? this.consentRepo.find({ skip, take, order: { id: 'ASC' } })
            : this.consentRepo.find({ where: { patientId: requesterId }, skip, take, order: { id: 'ASC' } }),
        async (batch) => append(batch.map((c) => JSON.stringify(FhirMapper.toConsent(c)))),
      );
    } else if (type === 'Provenance') {
      // Collect record IDs in batches to avoid unbounded IN clause
      const recordIds: string[] = [];
      await this.paginate(
        (skip, take) =>
          isAdmin
            ? this.recordRepo.find({ select: { id: true }, skip, take, order: { id: 'ASC' } })
            : this.recordRepo.find({ select: { id: true }, where: { patientId: requesterId }, skip, take, order: { id: 'ASC' } }),
        async (batch) => { recordIds.push(...batch.map((r) => r.id)); },
      );

      // Page through history using the collected IDs in slices
      for (let i = 0; i < recordIds.length; i += BATCH_SIZE) {
        const idSlice = recordIds.slice(i, i + BATCH_SIZE);
        await this.paginate(
          (skip, take) =>
            this.historyRepo
              .createQueryBuilder('h')
              .where('h.medicalRecordId IN (:...ids)', { ids: idSlice })
              .orderBy('h.id', 'ASC')
              .skip(skip)
              .take(take)
              .getMany(),
          async (batch) => append(FhirMapper.toProvenance(batch).map((r) => JSON.stringify(r))),
        );
      }
    }

    const ndjson = chunks.join('\n');
    const url = await this.uploadToIPFS(ndjson);
    return { url, count };
  }

  /** Generic keyset-style paginator using skip/take. */
  private async paginate<T>(
    fetcher: (skip: number, take: number) => Promise<T[]>,
    handler: (batch: T[]) => Promise<void>,
  ): Promise<void> {
    let skip = 0;
    while (true) {
      const batch = await fetcher(skip, BATCH_SIZE);
      if (!batch.length) break;
      await handler(batch);
      if (batch.length < BATCH_SIZE) break;
      skip += BATCH_SIZE;
    }
  }

  private async uploadToIPFS(content: string): Promise<string> {
    // Placeholder - integrate with actual IPFS service
    const hash = Buffer.from(content).toString('base64').substring(0, 46);
    return `ipfs://${hash}`;
  }

  async cleanupExpiredJobs(): Promise<void> {
    const expired = await this.jobRepo.find({
      where: { status: ExportJobStatus.COMPLETED },
    });

    const now = new Date();
    for (const job of expired) {
      if (job.expiresAt && job.expiresAt < now) {
        await this.jobRepo.remove(job);
      }
    }
  }
}
