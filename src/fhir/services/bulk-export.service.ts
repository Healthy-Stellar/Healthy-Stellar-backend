import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, FindOptionsWhere } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BulkExportJob, ExportJobStatus, ExportScope } from '../entities/bulk-export-job.entity';
import { generateSignedUrl } from '../utils/signed-url.util';
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
    since?: string,
    outputFormat?: string,
    exportScope?: ExportScope,
    groupId?: string,
  ): Promise<string> {
    const types = resourceTypes || ['Patient', 'DocumentReference', 'Consent', 'Provenance'];
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const job = this.jobRepo.create({
      requesterId,
      requesterRole,
      resourceTypes: types,
      status: ExportJobStatus.PENDING,
      expiresAt,
      since: since ? new Date(since) : null,
      outputFormat: outputFormat ?? 'application/fhir+ndjson',
      exportScope: exportScope ?? ExportScope.PATIENT,
      groupId: groupId ?? null,
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
        request: this.buildRequestUrl(job),
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
      const isAdmin = job.requesterRole === 'ADMIN' || job.exportScope === ExportScope.SYSTEM;

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
    const since = job.since ?? undefined;

    const append = async (lines: string[]) => {
      if (!lines.length) return;
      chunks.push(lines.join('\n'));
      count += lines.length;
      job.totalResources += lines.length;
      await this.jobRepo.save(job);
    };

    if (type === 'Patient') {
      const sinceWhere = since ? { updatedAt: MoreThan(since) } : {};
      await this.paginate(
        (skip, take) =>
          isAdmin
            ? this.patientRepo.find({ where: sinceWhere as FindOptionsWhere<Patient>, skip, take, order: { id: 'ASC' } })
            : this.patientRepo.find({ where: { id: requesterId, ...sinceWhere } as FindOptionsWhere<Patient>, skip, take }),
        async (batch) => append(batch.map((p) => JSON.stringify(FhirMapper.toPatient(p)))),
      );
    } else if (type === 'DocumentReference') {
      const sinceWhere = since ? { updatedAt: MoreThan(since) } : {};
      await this.paginate(
        (skip, take) =>
          isAdmin
            ? this.recordRepo.find({ where: sinceWhere as FindOptionsWhere<MedicalRecord>, skip, take, order: { id: 'ASC' } })
            : this.recordRepo.find({ where: { patientId: requesterId, ...sinceWhere } as FindOptionsWhere<MedicalRecord>, skip, take, order: { id: 'ASC' } }),
        async (batch) => append(batch.map((r) => JSON.stringify(FhirMapper.toDocumentReference(r)))),
      );
    } else if (type === 'Consent') {
      const sinceWhere = since ? { updatedAt: MoreThan(since) } : {};
      await this.paginate(
        (skip, take) =>
          isAdmin
            ? this.consentRepo.find({ where: sinceWhere as FindOptionsWhere<MedicalRecordConsent>, skip, take, order: { id: 'ASC' } })
            : this.consentRepo.find({ where: { patientId: requesterId, ...sinceWhere } as FindOptionsWhere<MedicalRecordConsent>, skip, take, order: { id: 'ASC' } }),
        async (batch) => append(batch.map((c) => JSON.stringify(FhirMapper.toConsent(c)))),
      );
    } else if (type === 'Provenance') {
      const recordIds: string[] = [];
      const sinceRecordWhere = since ? { updatedAt: MoreThan(since) } : {};
      await this.paginate(
        (skip, take) =>
          isAdmin
            ? this.recordRepo.find({ select: { id: true }, where: sinceRecordWhere as FindOptionsWhere<MedicalRecord>, skip, take, order: { id: 'ASC' } })
            : this.recordRepo.find({ select: { id: true }, where: { patientId: requesterId, ...sinceRecordWhere } as FindOptionsWhere<MedicalRecord>, skip, take, order: { id: 'ASC' } }),
        async (batch) => { recordIds.push(...batch.map((r) => r.id)); },
      );

      for (let i = 0; i < recordIds.length; i += BATCH_SIZE) {
        const idSlice = recordIds.slice(i, i + BATCH_SIZE);
        const qb = this.historyRepo
          .createQueryBuilder('h')
          .where('h.medicalRecordId IN (:...ids)', { ids: idSlice })
          .orderBy('h.id', 'ASC');

        if (since) {
          qb.andWhere('h.createdAt > :since', { since });
        }

        await this.paginate(
          (skip, take) => qb.clone().skip(skip).take(take).getMany(),
          async (batch) => append(FhirMapper.toProvenance(batch).map((r) => JSON.stringify(r))),
        );
      }
    }

    const url = generateSignedUrl(job.id, type, job.outputFormat);
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

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private buildRequestUrl(job: BulkExportJob): string {
    const base = job.exportScope === ExportScope.SYSTEM
      ? '/fhir/r4/$export'
      : job.exportScope === ExportScope.GROUP
        ? `/fhir/r4/Group/${job.groupId}/$export`
        : '/fhir/r4/Patient/$export';

    const params = [`_type=${job.resourceTypes.join(',')}`];
    if (job.since) params.push(`_since=${job.since.toISOString()}`);
    if (job.outputFormat && job.outputFormat !== 'application/fhir+ndjson') {
      params.push(`_outputFormat=${encodeURIComponent(job.outputFormat)}`);
    }

    return `${base}?${params.join('&')}`;
  }
}
