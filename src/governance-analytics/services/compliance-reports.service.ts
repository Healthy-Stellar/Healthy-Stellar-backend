import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Repository, And, MoreThanOrEqual, LessThan } from 'typeorm';
import { Queue } from 'bullmq';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { ComplianceReportJob, ComplianceReportStatus } from '../entities/compliance-report-job.entity';
import { GenerateComplianceReportDto } from '../dto/compliance-report.dto';
import { AuditLogEntity, AuditAction } from '../../common/audit/audit-log.entity';
import { AuditService } from '../../common/audit/audit.service';
import { QUEUE_NAMES } from '../../queues/queue.constants';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const STORAGE_DIR =
  process.env.COMPLIANCE_REPORT_STORAGE_DIR ?? path.join(process.cwd(), 'storage', 'compliance-reports');

interface ComplianceReportSections {
  accessLogs: AuditLogEntity[];
  failedAuthAttempts: AuditLogEntity[];
  dataExports: AuditLogEntity[];
  roleChanges: AuditLogEntity[];
}

@Injectable()
export class ComplianceReportsService {
  private readonly logger = new Logger(ComplianceReportsService.name);

  constructor(
    @InjectRepository(ComplianceReportJob)
    private readonly jobRepository: Repository<ComplianceReportJob>,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
    @InjectQueue(QUEUE_NAMES.COMPLIANCE_REPORTS)
    private readonly queue: Queue,
    private readonly auditService: AuditService,
  ) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  async requestReport(
    dto: GenerateComplianceReportDto,
    requestedByUserId: string,
    tenantId: string | null,
  ): Promise<{ jobId: string; status: ComplianceReportStatus }> {
    if (new Date(dto.startDate) > new Date(dto.endDate)) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const job = await this.jobRepository.save(
      this.jobRepository.create({
        reportType: dto.reportType,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: ComplianceReportStatus.PENDING,
        requestedByUserId,
        tenantId,
      }),
    );

    await this.queue.add('generate-compliance-report', { jobId: job.id });

    if (requestedByUserId) {
      await this.auditService.log({
        actorId: requestedByUserId,
        action: 'COMPLIANCE_REPORT_REQUESTED',
        resourceId: job.id,
        resourceType: 'ComplianceReportJob',
      } as any);
    }

    return { jobId: job.id, status: job.status };
  }

  async getJob(jobId: string, tenantId: string | null): Promise<ComplianceReportJob> {
    const job = await this.jobRepository.findOne({
      where: { id: jobId, tenantId: tenantId ?? IsNull() },
    });
    if (!job) {
      throw new NotFoundException(`Compliance report job ${jobId} not found`);
    }
    return job;
  }

  async process(jobId: string): Promise<void> {
    // Internal worker lookup: the job's own tenantId drives the scope, not a caller.
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Compliance report job ${jobId} not found`);
    }

    try {
      job.status = ComplianceReportStatus.PROCESSING;
      await this.jobRepository.save(job);

      const sections = await this.collectSections(
        ComplianceReportsService.toDay(job.startDate),
        ComplianceReportsService.toDay(job.endDate),
      );

      const pdfBuffer = await this.buildPdf(job, sections);
      const csvBuffer = this.buildCsv(sections);

      const pdfPath = path.join(STORAGE_DIR, `${job.id}.pdf`);
      const csvPath = path.join(STORAGE_DIR, `${job.id}.csv`);
      fs.writeFileSync(pdfPath, pdfBuffer);
      fs.writeFileSync(csvPath, csvBuffer);

      job.status = ComplianceReportStatus.COMPLETED;
      job.pdfPath = pdfPath;
      job.csvPath = csvPath;
      job.generatedAt = new Date();
      job.summary = {
        accessLogCount: sections.accessLogs.length,
        failedAuthAttemptCount: sections.failedAuthAttempts.length,
        dataExportCount: sections.dataExports.length,
        roleChangeCount: sections.roleChanges.length,
      };
      await this.jobRepository.save(job);

      if (job.requestedByUserId) {
        await this.auditService.log({
          actorId: job.requestedByUserId,
          action: 'COMPLIANCE_REPORT_GENERATED',
          resourceId: job.id,
          resourceType: 'ComplianceReportJob',
        } as any);
      }
    } catch (error: any) {
      this.logger.error(`Compliance report generation failed for job ${jobId}`, error.stack);
      job.status = ComplianceReportStatus.FAILED;
      job.errorDetails = error.message;
      await this.jobRepository.save(job);
    }
  }

  async download(
    jobId: string,
    format: 'pdf' | 'csv',
    tenantId: string | null,
    downloadedByUserId?: string,
  ): Promise<Buffer> {
    const job = await this.getJob(jobId, tenantId);

    if (job.status !== ComplianceReportStatus.COMPLETED) {
      throw new BadRequestException(`Report is not ready (status: ${job.status})`);
    }

    const filePath = format === 'pdf' ? job.pdfPath : job.csvPath;
    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException('Report file not found');
    }

    job.downloadCount += 1;
    await this.jobRepository.save(job);

    if (downloadedByUserId) {
      await this.auditService.log({
        actorId: downloadedByUserId,
        action: 'COMPLIANCE_REPORT_DOWNLOADED',
        resourceId: job.id,
        resourceType: 'ComplianceReportJob',
      } as any);
    }

    return fs.readFileSync(filePath);
  }

  /**
   * Normalise a `date` column value to a Date at UTC midnight of that day.
   * TypeORM returns Postgres `date` columns as 'YYYY-MM-DD' strings, so the
   * entity value cannot be assumed to be a Date.
   */
  static toDay(value: Date | string): Date {
    const iso = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    return new Date(`${iso}T00:00:00.000Z`);
  }

  private static formatDay(value: Date | string): string {
    return ComplianceReportsService.toDay(value).toISOString().slice(0, 10);
  }

  /**
   * Collect audit entries for the inclusive day range [startDate, endDate]:
   * `timestamp >= startDate 00:00` and `timestamp < endDate + 1 day`.
   */
  private async collectSections(startDate: Date, endDate: Date): Promise<ComplianceReportSections> {
    const endExclusive = new Date(endDate.getTime() + ONE_DAY_MS);
    const range = And(MoreThanOrEqual(startDate), LessThan(endExclusive));

    const [accessLogs, failedAuthAttempts, dataExports, roleChanges] = await Promise.all([
      this.auditLogRepository.find({ where: { action: AuditAction.DATA_ACCESS, timestamp: range } }),
      this.auditLogRepository.find({ where: { action: AuditAction.LOGIN_FAILED, timestamp: range } }),
      this.auditLogRepository.find({ where: { action: AuditAction.DATA_EXPORT, timestamp: range } }),
      this.auditLogRepository
        .createQueryBuilder('audit')
        .where('audit.action ILIKE :pattern', { pattern: '%ROLE%' })
        .andWhere('audit.timestamp >= :start AND audit.timestamp < :end', {
          start: startDate,
          end: endExclusive,
        })
        .getMany(),
    ]);

    return { accessLogs, failedAuthAttempts, dataExports, roleChanges };
  }

  private buildPdf(job: ComplianceReportJob, sections: ComplianceReportSections): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text(`${job.reportType} Compliance Report`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10);
      doc.text(
        `Period: ${ComplianceReportsService.formatDay(job.startDate)} to ${ComplianceReportsService.formatDay(job.endDate)}`,
      );
      doc.text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown(1.5);

      this.renderSection(doc, 'Access Log Summary', sections.accessLogs);
      this.renderSection(doc, 'Failed Authentication Attempts', sections.failedAuthAttempts);
      this.renderSection(doc, 'Data Exports', sections.dataExports);
      this.renderSection(doc, 'Role Changes', sections.roleChanges);

      doc.end();
    });
  }

  private renderSection(doc: any, title: string, entries: AuditLogEntity[]): void {
    doc.fontSize(14).text(`${title} (${entries.length})`);
    doc.moveDown(0.5);
    if (entries.length === 0) {
      doc.fontSize(10).text('No entries in this period.');
    }
    entries.slice(0, 200).forEach((entry) => {
      doc.fontSize(9).text(`[${new Date(entry.timestamp).toISOString()}] ${entry.action} - user:${entry.userId ?? 'n/a'}`);
    });
    doc.moveDown();
  }

  private buildCsv(sections: ComplianceReportSections): Buffer {
    let csv = 'Section,Timestamp,Action,UserId,ResourceType,ResourceId\n';
    const appendRows = (section: string, entries: AuditLogEntity[]) => {
      entries.forEach((entry) => {
        csv += `${section},${new Date(entry.timestamp).toISOString()},${entry.action},${entry.userId ?? ''},${entry.resourceType ?? ''},${entry.resourceId ?? ''}\n`;
      });
    };

    appendRows('ACCESS_LOG', sections.accessLogs);
    appendRows('FAILED_AUTH', sections.failedAuthAttempts);
    appendRows('DATA_EXPORT', sections.dataExports);
    appendRows('ROLE_CHANGE', sections.roleChanges);

    return Buffer.from(csv, 'utf-8');
  }
}
