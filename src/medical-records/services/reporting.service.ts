import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { MedicalRecord, RecordType, MedicalRecordStatus } from '../entities/medical-record.entity';
import { MedicalHistory, HistoryEventType } from '../entities/medical-history.entity';
import { MedicalRecordConsent, ConsentStatus } from '../entities/medical-record-consent.entity';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(
    @InjectRepository(MedicalRecord)
    private medicalRecordRepository: Repository<MedicalRecord>,
    @InjectRepository(MedicalHistory)
    private historyRepository: Repository<MedicalHistory>,
    @InjectRepository(MedicalRecordConsent)
    private consentRepository: Repository<MedicalRecordConsent>,
  ) {}

  async getPatientSummary(patientId: string, startDate?: Date, endDate?: Date) {
    const where: any = { patientId };

    if (startDate && endDate) {
      where.recordDate = Between(startDate, endDate);
    } else if (startDate) {
      where.recordDate = Between(startDate, new Date());
    }

    const records = await this.medicalRecordRepository.find({
      where,
      relations: ['attachments'],
    });

    const summary = {
      totalRecords: records.length,
      byType: this.groupByType(records),
      byStatus: this.groupByStatus(records),
      totalAttachments: records.reduce((sum, r) => sum + (r.attachments?.length || 0), 0),
      dateRange: {
        start: startDate || null,
        end: endDate || null,
      },
    };

    return summary;
  }

  async getActivityReport(patientId?: string, startDate?: Date, endDate?: Date) {
    const where: any = {};

    if (patientId) {
      where.patientId = patientId;
    }

    if (startDate && endDate) {
      where.eventDate = Between(startDate, endDate);
    } else if (startDate) {
      where.eventDate = Between(startDate, new Date());
    }

    const activities = await this.historyRepository.find({
      where,
      order: { eventDate: 'DESC' },
    });

    return {
      totalActivities: activities.length,
      byEventType: this.groupByEventType(activities),
      activities: activities.slice(0, 100), // Limit to 100 most recent
    };
  }

  async getConsentReport(patientId?: string) {
    const where: any = {};

    if (patientId) {
      where.patientId = patientId;
    }

    const consents = await this.consentRepository.find({
      where,
      relations: ['medicalRecord'],
    });

    return {
      totalConsents: consents.length,
      byStatus: this.groupConsentsByStatus(consents),
      byType: this.groupConsentsByType(consents),
      activeConsents: consents.filter(
        (c) => c.status === ConsentStatus.GRANTED && (!c.expiresAt || c.expiresAt > new Date()),
      ).length,
      expiredConsents: consents.filter((c) => c.status === ConsentStatus.EXPIRED).length,
    };
  }

  async getRecordStatistics(startDate?: Date, endDate?: Date) {
    const where: any = {};

    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    } else if (startDate) {
      where.createdAt = Between(startDate, new Date());
    }

    const records = await this.medicalRecordRepository.find({ where });

    return {
      totalRecords: records.length,
      byType: this.groupByType(records),
      byStatus: this.groupByStatus(records),
      averageRecordsPerDay: this.calculateAveragePerDay(records, startDate, endDate),
    };
  }

  private groupByType(records: MedicalRecord[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    records.forEach((record) => {
      grouped[record.recordType] = (grouped[record.recordType] || 0) + 1;
    });
    return grouped;
  }

  private groupByStatus(records: MedicalRecord[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    records.forEach((record) => {
      grouped[record.status] = (grouped[record.status] || 0) + 1;
    });
    return grouped;
  }

  private groupByEventType(activities: MedicalHistory[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    activities.forEach((activity) => {
      grouped[activity.eventType] = (grouped[activity.eventType] || 0) + 1;
    });
    return grouped;
  }

  private groupConsentsByStatus(consents: MedicalRecordConsent[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    consents.forEach((consent) => {
      grouped[consent.status] = (grouped[consent.status] || 0) + 1;
    });
    return grouped;
  }

  private groupConsentsByType(consents: MedicalRecordConsent[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    consents.forEach((consent) => {
      grouped[consent.consentType] = (grouped[consent.consentType] || 0) + 1;
    });
    return grouped;
  }

  private calculateAveragePerDay(
    records: MedicalRecord[],
    startDate?: Date,
    endDate?: Date,
  ): number {
    if (records.length === 0) return 0;

    const start = startDate || records[0].createdAt;
    const end = endDate || new Date();
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    return records.length / days;
  }
}
