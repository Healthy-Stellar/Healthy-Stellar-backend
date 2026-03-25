import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalRecord } from '../entities/medical-record.entity';
import { MedicalHistory } from '../entities/medical-history.entity';
import { MedicalRecordConsent } from '../entities/medical-record-consent.entity';
import PDFDocument from 'pdfkit';
import { createObjectCsvWriter } from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportBuilderService {
  private readonly logger = new Logger(ReportBuilderService.name);

  constructor(
    @InjectRepository(MedicalRecord)
    private medicalRecordRepository: Repository<MedicalRecord>,
    @InjectRepository(MedicalHistory)
    private historyRepository: Repository<MedicalHistory>,
    @InjectRepository(MedicalRecordConsent)
    private consentRepository: Repository<MedicalRecordConsent>,
  ) {}

  async generatePDF(patientId: string, outputPath: string): Promise<void> {
    const data = await this.collectReportData(patientId);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(outputPath);

      stream.on('finish', () => resolve());
      stream.on('error', reject);

      doc.pipe(stream);

      doc.fontSize(20).text('Medical Record Activity Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Patient ID: ${patientId}`);
      doc.text(`Generated: ${new Date().toISOString()}`);
      doc.moveDown();

      doc.fontSize(16).text('Medical Records Owned');
      doc.fontSize(10);
      data.records.forEach((record) => {
        doc.text(`- ${record.recordType} | ${record.recordDate} | Status: ${record.status}`);
        if (record.stellarTxHash) doc.text(`  Stellar TX: ${record.stellarTxHash}`);
      });
      doc.moveDown();

      doc.fontSize(16).text('Access Grants');
      doc.fontSize(10);
      data.consents.forEach((consent) => {
        doc.text(`- ${consent.consentType} | Status: ${consent.status} | Granted: ${consent.grantedAt}`);
        if (consent.expiresAt) doc.text(`  Expires: ${consent.expiresAt}`);
        if (consent.revokedAt) doc.text(`  Revoked: ${consent.revokedAt}`);
      });
      doc.moveDown();

      doc.fontSize(16).text('Audit Log');
      doc.fontSize(10);
      data.auditLog.forEach((log) => {
        doc.text(`- ${log.eventDate} | ${log.eventType} | ${log.performedBy || 'System'}`);
      });

      doc.end();
    });
  }

  async generateCSV(patientId: string, outputPath: string): Promise<void> {
    const data = await this.collectReportData(patientId);

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: 'type', title: 'Type' },
        { id: 'date', title: 'Date' },
        { id: 'action', title: 'Action' },
        { id: 'status', title: 'Status' },
        { id: 'stellarTx', title: 'Stellar TX Hash' },
        { id: 'details', title: 'Details' },
      ],
    });

    const records = [
      ...data.records.map((r) => ({
        type: 'Medical Record',
        date: r.recordDate,
        action: r.recordType,
        status: r.status,
        stellarTx: r.stellarTxHash || '',
        details: `Record ID: ${r.id}`,
      })),
      ...data.consents.map((c) => ({
        type: 'Consent',
        date: c.grantedAt,
        action: c.consentType,
        status: c.status,
        stellarTx: '',
        details: `Expires: ${c.expiresAt || 'Never'}`,
      })),
      ...data.auditLog.map((a) => ({
        type: 'Audit',
        date: a.eventDate,
        action: a.eventType,
        status: '',
        stellarTx: '',
        details: `By: ${a.performedBy || 'System'}`,
      })),
    ];

    await csvWriter.writeRecords(records);
  }

  private async collectReportData(patientId: string) {
    const records = await this.medicalRecordRepository.find({
      where: { patientId },
      order: { recordDate: 'DESC' },
    });

    const consents = await this.consentRepository.find({
      where: { patientId },
      order: { grantedAt: 'DESC' },
    });

    const auditLog = await this.historyRepository.find({
      where: { patientId },
      order: { eventDate: 'DESC' },
    });

    return { records, consents, auditLog };
  }
}
