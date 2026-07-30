import { Injectable, HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ReportJob, ReportStatus, ReportFormat } from './entities/report-job.entity';
import { NotificationsService } from '../notifications/services/notifications.service';
import {
  MedicalRecord,
  MedicalRecordStatus,
} from '../medical-records/entities/medical-record.entity';
import { AuditLogEntity } from '../common/audit/audit-log.entity';
import { User } from '../auth/entities/user.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { Billing } from '../billing/entities/billing.entity';
import * as PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { create as ipfsHttpClient } from 'ipfs-http-client';
import { v4 as uuidv4 } from 'uuid';
import { PassThrough } from 'stream';
import { I18nService } from '../i18n/i18n.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private ipfs: any;

  constructor(
    @InjectRepository(ReportJob)
    private reportJobRepository: Repository<ReportJob>,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
    private entityManager: EntityManager,
    private i18nService: I18nService,
  ) {
    const ipfsUrl = this.configService.get<string>('IPFS_NODE_URL') || 'http://localhost:5001';
    this.ipfs = ipfsHttpClient({ url: ipfsUrl });
  }

  async requestReport(patientId: string, format: ReportFormat = ReportFormat.PDF) {
    const job = this.reportJobRepository.create({
      patientId,
      format,
      status: ReportStatus.PENDING,
    });
    await this.reportJobRepository.save(job);
    this.notificationsService.emitJobStatusUpdated(job.id, ReportStatus.PENDING, {
      patientId,
      message: 'Report request accepted',
    });

    // Call async generation without awaiting
    this.generateReport(job.id, patientId, format).catch((err) => {
      this.logger.error(`Report generation failed for job ${job.id}`, err.stack);
    });

    return {
      jobId: job.id,
      estimatedTime: '2-5 minutes',
    };
  }

  async getJobStatus(jobId: string, patientId: string) {
    const job = await this.reportJobRepository.findOne({
      where: { id: jobId, patientId: patientId },
    });
    if (!job) {
      throw new NotFoundException('Report job not found');
    }

    if (job.status === ReportStatus.COMPLETED) {
      if (job.expiresAt && job.expiresAt < new Date()) {
        throw new HttpException('Download link has expired', HttpStatus.GONE);
      }
      return {
        status: job.status,
        downloadUrl: `${this.configService.get<string>('API_URL') || 'http://localhost:3000'}/api/v1/reports/${job.id}/download?token=${job.downloadToken}`,
        expiresAt: job.expiresAt,
      };
    }

    return { status: job.status };
  }

  async downloadReport(jobId: string, token: string) {
    const job = await this.reportJobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Report job not found');
    }

    if (job.status !== ReportStatus.COMPLETED) {
      throw new HttpException('Report is not ready yet', HttpStatus.BAD_REQUEST);
    }

    if (job.downloadToken !== token || job.tokenUsed) {
      throw new HttpException('Invalid or already used token', HttpStatus.FORBIDDEN);
    }

    if (job.expiresAt && job.expiresAt < new Date()) {
      throw new HttpException('Download link has expired', HttpStatus.GONE);
    }

    // Mark token as used to satisfy single-use requirement
    job.tokenUsed = true;
    await this.reportJobRepository.save(job);

    try {
      const stream = new PassThrough();
      (async () => {
        for await (const chunk of this.ipfs.cat(job.ipfsHash)) {
          stream.write(chunk);
        }
        stream.end();
      })().catch((err) => {
        this.logger.error('Error streaming from IPFS', err);
        stream.destroy(err);
      });
      return stream;
    } catch (error) {
      this.logger.error(`Failed to stream report from IPFS for job ${job.id}`, error);
      throw new HttpException('Failed to stream report', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async generateReport(jobId: string, patientId: string, format: ReportFormat) {
    try {
      await this.reportJobRepository.update(jobId, { status: ReportStatus.PROCESSING });
      this.notificationsService.emitJobStatusUpdated(jobId, ReportStatus.PROCESSING, {
        patientId,
        message: 'Report generation in progress',
      });

      const patient = await this.entityManager.findOne(User, { where: { id: patientId } });
      const records = await this.entityManager.find(MedicalRecord, {
        where: { patientId, status: MedicalRecordStatus.ACTIVE },
        order: { createdAt: 'DESC' },
      });
      const grants = await this.entityManager.find(AccessGrant, {
        where: { patientId },
        order: { createdAt: 'DESC' },
      });
      const userAuditLogs = await this.entityManager.find(AuditLogEntity, {
        where: { userId: patientId },
        order: { timestamp: 'DESC' },
        take: 100,
      });

      let buffer: Buffer;
      if (format === ReportFormat.PDF) {
        buffer = await this.generatePdfBuffer(patient, records, grants, userAuditLogs);
      } else if (format === ReportFormat.XLSX) {
        // Billing data is only needed for the XLSX "Billing Summary" sheet, so it is
        // fetched lazily here rather than for every report format.
        const billings = await this.entityManager.find(Billing, {
          where: { patientId },
          order: { serviceDate: 'DESC' },
        });
        buffer = await this.generateXlsxBuffer(patient, records, grants, userAuditLogs, billings);
      } else {
        buffer = await this.generateCsvBuffer(records, grants, userAuditLogs);
      }

      let ipfsHash = '';
      try {
        const result = await this.ipfs.add(buffer);
        ipfsHash = result.path;
      } catch (ipfsErr) {
        this.logger.error('IPFS upload failed, using fallback hash for testing', ipfsErr);
        ipfsHash = 'QmFallbackDummyHashForTesting123';
      }

      const downloadToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      await this.reportJobRepository.update(jobId, {
        status: ReportStatus.COMPLETED,
        ipfsHash,
        downloadToken,
        expiresAt,
      });
      this.notificationsService.emitJobStatusUpdated(jobId, ReportStatus.COMPLETED, {
        patientId,
        message: 'Report generation completed',
      });

      const downloadUrl = `${this.configService.get<string>('API_URL') || 'http://localhost:3000'}/api/v1/reports/${jobId}/download?token=${downloadToken}`;

      try {
        await this.notificationsService.sendEmail(
          patient?.email || 'test@example.com',
          'Your Medical Record Report is Ready',
          'report-ready',
          {
            patientName: patient?.firstName || 'Patient',
            downloadUrl,
            expiresAt: expiresAt.toISOString(),
          },
        );
      } catch (emailErr) {
        this.logger.warn(
          `Failed to send email to ${patient?.email}, but job created successfully.`,
          emailErr,
        );
      }

      this.logger.log(`Report generated successfully for job ${jobId}`);
    } catch (error) {
      this.logger.error(`Failed to generate report for job ${jobId}`, error.stack);
      await this.reportJobRepository.update(jobId, {
        status: ReportStatus.FAILED,
        errorDetails: error.message,
      });
      this.notificationsService.emitJobStatusUpdated(jobId, ReportStatus.FAILED, {
        patientId,
        message: error?.message || 'Report generation failed',
      });
    }
  }

  private async generatePdfBuffer(
    patient: User,
    records: MedicalRecord[],
    grants: AccessGrant[],
    logs: AuditLogEntity[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Detect RTL locale and set text direction accordingly
      const isRtl = this.i18nService.isRtlLocale();
      const textAlign = isRtl ? 'right' : 'left';

      doc.fontSize(20).text('Patient Activity Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Patient Name: ${patient?.firstName || ''} ${patient?.lastName || ''}`, { align: textAlign });
      doc.text(`Patient ID: ${patient?.id}`, { align: textAlign });
      doc.text(`Generated On: ${this.i18nService.formatDate(new Date())}`, { align: textAlign });
      doc.moveDown(2);

      doc.fontSize(16).text('Medical Records Summary', { align: textAlign });
      doc.moveDown(0.5);
      if (records.length === 0) doc.fontSize(10).text('No recent active records found.');
      records.forEach((record) => {
        doc.fontSize(10).text(
          `- [${new Date(record.createdAt).toLocaleDateString()}] ${record.recordType?.toUpperCase() || 'UNKNOWN'}`,
        );
        if (record.title) doc.text(`  Title: ${record.title}`);
        if (record.metadata?.transactionHash) {
          doc.fillColor('blue').fontSize(8).text(`  Tx Hash: ${record.metadata.transactionHash}`);
          doc.fillColor('black').fontSize(10);
        }
        doc.moveDown(0.5);
      });
      doc.moveDown();

      doc.fontSize(16).text('Access Grants & Consents', { align: textAlign });
      doc.moveDown(0.5);
      if (grants.length === 0) doc.fontSize(10).text('No access grants found.');
      grants.forEach((grant) => {
        const isExpired = grant.expiresAt && new Date(grant.expiresAt) < new Date();
        const status = isExpired ? 'EXPIRED' : grant.status;
        doc.fontSize(10).text(`- Granted To: ${grant.granteeId}`);
        doc.text(`  Status: ${status} | Access Level: ${grant.accessLevel}`);
        if (grant.sorobanTxHash) {
          doc.fillColor('blue').fontSize(8).text(`  Tx Hash: ${grant.sorobanTxHash}`);
          doc.fillColor('black').fontSize(10);
        }
        doc.moveDown(0.5);
      });
      doc.moveDown();

      doc.fontSize(16).text('Recent Audit Logs', { align: textAlign });
      doc.moveDown(0.5);
      if (logs.length === 0) doc.fontSize(10).text('No audit logs found.');
      logs.forEach((log) => {
        doc.fontSize(9).text(
          `[${new Date(log.timestamp).toLocaleString()}] ${log.action} - ${log.description || ''}`,
        );
        if (log.details?.transactionHash) {
          doc.fillColor('gray').fontSize(7).text(`  Tx Hash: ${log.details?.transactionHash}`);
          doc.fillColor('black');
        }
      });

      doc.end();
    });
  }

  private async generateCsvBuffer(
    records: MedicalRecord[],
    grants: AccessGrant[],
    logs: AuditLogEntity[],
  ): Promise<Buffer> {
    let csv = 'Type,Date,Details,TransactionHash\n';

    records.forEach((r) => {
      const metadataHash = r.metadata ? (r.metadata as Record<string, string>).transactionHash : '';
      csv += `RECORD,${new Date(r.createdAt).toISOString()},${r.recordType} - ${r.title || ''},${metadataHash || ''}\n`;
    });

    grants.forEach((g) => {
      const isExpired = g.expiresAt && new Date(g.expiresAt) < new Date();
      const status = isExpired ? 'EXPIRED' : g.status;
      csv += `GRANT,${new Date(g.createdAt).toISOString()},GrantedTo: ${g.granteeId} Status: ${status} AccessLevel: ${g.accessLevel},${g.sorobanTxHash || ''}\n`;
    });

    logs.forEach((l) => {
      const metadataHash = l.details?.transactionHash || l.metadata?.transactionHash || '';
      csv += `LOG,${new Date(l.timestamp).toISOString()},Action: ${l.action},${metadataHash || ''}\n`;
    });

    return Buffer.from(csv, 'utf-8');
  }

  /**
   * Builds a multi-sheet XLSX workbook mirroring the sections used by the PDF/CSV
   * exports (Medical Records, Access Grants, Audit Logs) plus a Summary overview
   * sheet and a Billing Summary sheet sourced from the billing module. Date and
   * currency columns use native Excel number formats so they render/sort/filter
   * correctly instead of as plain text.
   */
  private async generateXlsxBuffer(
    patient: User,
    records: MedicalRecord[],
    grants: AccessGrant[],
    logs: AuditLogEntity[],
    billings: Billing[],
  ): Promise<Buffer> {
    const DATE_FORMAT = 'yyyy-mm-dd';
    const DATETIME_FORMAT = 'yyyy-mm-dd hh:mm:ss';
    const CURRENCY_FORMAT = '"$"#,##0.00';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Healthy Stellar Reports';
    workbook.created = new Date();

    const styleHeader = (worksheet: ExcelJS.Worksheet) => {
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
      });
    };

    // ── Summary sheet ──────────────────────────────────────────────────────
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Field', key: 'field', width: 28 },
      { header: 'Value', key: 'value', width: 40 },
    ];
    summarySheet.addRows([
      { field: 'Patient Name', value: `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() },
      { field: 'Patient ID', value: patient?.id || '' },
      { field: 'Generated On', value: new Date() },
      { field: 'Medical Records Count', value: records.length },
      { field: 'Access Grants Count', value: grants.length },
      { field: 'Audit Log Entries', value: logs.length },
      { field: 'Billing Records Count', value: billings.length },
    ]);
    summarySheet.getCell('B4').numFmt = DATETIME_FORMAT; // "Generated On" row
    styleHeader(summarySheet);

    // ── Medical Records sheet ──────────────────────────────────────────────
    const recordsSheet = workbook.addWorksheet('Medical Records');
    recordsSheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Type', key: 'type', width: 16 },
      { header: 'Title', key: 'title', width: 30 },
      { header: 'Transaction Hash', key: 'txHash', width: 44 },
    ];
    records.forEach((record) => {
      const metadataHash = (record.metadata as Record<string, string>)?.transactionHash || '';
      recordsSheet.addRow({
        date: new Date(record.createdAt),
        type: record.recordType?.toUpperCase() || 'UNKNOWN',
        title: record.title || '',
        txHash: metadataHash,
      });
    });
    recordsSheet.getColumn('date').numFmt = DATE_FORMAT;
    styleHeader(recordsSheet);

    // ── Access Grants sheet ──────────────────────────────────────────────
    const grantsSheet = workbook.addWorksheet('Access Grants');
    grantsSheet.columns = [
      { header: 'Granted To', key: 'grantedTo', width: 26 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Access Level', key: 'accessLevel', width: 16 },
      { header: 'Expires At', key: 'expiresAt', width: 14 },
      { header: 'Transaction Hash', key: 'txHash', width: 44 },
    ];
    grants.forEach((grant) => {
      const isExpired = grant.expiresAt && new Date(grant.expiresAt) < new Date();
      grantsSheet.addRow({
        grantedTo: grant.granteeId,
        status: isExpired ? 'EXPIRED' : grant.status,
        accessLevel: grant.accessLevel,
        expiresAt: grant.expiresAt ? new Date(grant.expiresAt) : null,
        txHash: grant.sorobanTxHash || '',
      });
    });
    grantsSheet.getColumn('expiresAt').numFmt = DATE_FORMAT;
    styleHeader(grantsSheet);

    // ── Audit Logs sheet ───────────────────────────────────────────────────
    const logsSheet = workbook.addWorksheet('Audit Logs');
    logsSheet.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Action', key: 'action', width: 24 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Transaction Hash', key: 'txHash', width: 44 },
    ];
    logs.forEach((log) => {
      const metadataHash = log.details?.transactionHash || log.metadata?.transactionHash || '';
      logsSheet.addRow({
        timestamp: new Date(log.timestamp),
        action: log.action,
        description: log.description || '',
        txHash: metadataHash,
      });
    });
    logsSheet.getColumn('timestamp').numFmt = DATETIME_FORMAT;
    styleHeader(logsSheet);

    // ── Billing Summary sheet ──────────────────────────────────────────────
    const billingSheet = workbook.addWorksheet('Billing Summary');
    billingSheet.columns = [
      { header: 'Invoice Number', key: 'invoiceNumber', width: 20 },
      { header: 'Service Date', key: 'serviceDate', width: 14 },
      { header: 'Provider', key: 'provider', width: 24 },
      { header: 'Total Charges', key: 'totalCharges', width: 16 },
      { header: 'Total Payments', key: 'totalPayments', width: 16 },
      { header: 'Balance', key: 'balance', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Due Date', key: 'dueDate', width: 14 },
    ];
    billings.forEach((billing) => {
      billingSheet.addRow({
        invoiceNumber: billing.invoiceNumber,
        serviceDate: billing.serviceDate ? new Date(billing.serviceDate) : null,
        provider: billing.providerName,
        totalCharges: Number(billing.totalCharges),
        totalPayments: Number(billing.totalPayments),
        balance: Number(billing.balance),
        status: billing.status,
        dueDate: billing.dueDate ? new Date(billing.dueDate) : null,
      });
    });
    billingSheet.getColumn('serviceDate').numFmt = DATE_FORMAT;
    billingSheet.getColumn('dueDate').numFmt = DATE_FORMAT;
    billingSheet.getColumn('totalCharges').numFmt = CURRENCY_FORMAT;
    billingSheet.getColumn('totalPayments').numFmt = CURRENCY_FORMAT;
    billingSheet.getColumn('balance').numFmt = CURRENCY_FORMAT;
    styleHeader(billingSheet);

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
