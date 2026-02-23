import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BulkExportJob, ExportJobStatus } from '../entities/bulk-export-job.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { MedicalRecord } from '../../medical-records/entities/medical-record.entity';
import { MedicalRecordConsent } from '../../medical-records/entities/medical-record-consent.entity';
import { MedicalHistory } from '../../medical-records/entities/medical-history.entity';
import { FhirMapper } from '../mappers/fhir.mapper';
import { Readable } from 'stream';

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

  async initiateExport(requesterId: string, requesterRole: string, resourceTypes?: string[]): Promise<string> {
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
        const { url, count } = await this.exportResourceType(type, job.requesterId, isAdmin);
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

  private async exportResourceType(type: string, requesterId: string, isAdmin: boolean): Promise<{ url: string; count: number }> {
    let resources = [];

    switch (type) {
      case 'Patient':
        const patients = isAdmin ? await this.patientRepo.find() : await this.patientRepo.find({ where: { id: requesterId } });
        resources = patients.map(p => FhirMapper.toPatient(p));
        break;

      case 'DocumentReference':
        const records = isAdmin ? await this.recordRepo.find() : await this.recordRepo.find({ where: { patientId: requesterId } });
        resources = records.map(r => FhirMapper.toDocumentReference(r));
        break;

      case 'Consent':
        const consents = isAdmin ? await this.consentRepo.find() : await this.consentRepo.find({ where: { patientId: requesterId } });
        resources = consents.map(c => FhirMapper.toConsent(c));
        break;

      case 'Provenance':
        const recordIds = isAdmin 
          ? (await this.recordRepo.find()).map(r => r.id)
          : (await this.recordRepo.find({ where: { patientId: requesterId } })).map(r => r.id);
        const histories = await this.historyRepo.find({ where: { medicalRecordId: In(recordIds) } });
        resources = FhirMapper.toProvenance(histories);
        break;
    }

    const ndjson = resources.map(r => JSON.stringify(r)).join('\n');
    const ipfsUrl = await this.uploadToIPFS(ndjson);

    return { url: ipfsUrl, count: resources.length };
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
