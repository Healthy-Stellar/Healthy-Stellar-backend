import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  MedicationErrorLog,
  ErrorType,
  ErrorSeverity,
} from '../entities/medication-error-log.entity';

export interface ReportErrorDto {
  errorType: ErrorType;
  severity: ErrorSeverity;
  prescriptionId: string;
  drugId?: string;
  drugName?: string;
  patientId: string;
  patientName: string;
  errorDescription: string;
  contributingFactors?: string;
  reportedBy: string;
  reporterRole: string;
  discoveredBy?: string;
  discoveredAt?: Date;
  correctiveActions?: string;
  preventiveActions?: string;
}

@Injectable()
export class MedicationErrorService {
  constructor(
    @InjectRepository(MedicationErrorLog)
    private errorRepository: Repository<MedicationErrorLog>,
  ) {}

  async reportError(reportDto: ReportErrorDto): Promise<MedicationErrorLog> {
    const errorNumber = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const errorLog = this.errorRepository.create({
      ...reportDto,
      errorNumber,
      status: 'open',
      occurredAt: reportDto.discoveredAt || new Date(),
      reportedAt: new Date(),
    });

    return await this.errorRepository.save(errorLog);
  }

  async findOne(id: string): Promise<MedicationErrorLog> {
    const error = await this.errorRepository.findOne({ where: { id } });
    if (!error) {
      throw new NotFoundException(`Medication error ${id} not found`);
    }
    return error;
  }

  async updateError(
    id: string,
    updateDto: Partial<MedicationErrorLog>,
  ): Promise<MedicationErrorLog> {
    const error = await this.findOne(id);
    Object.assign(error, updateDto);
    return await this.errorRepository.save(error);
  }

  async addCorrectiveAction(id: string, action: string): Promise<MedicationErrorLog> {
    const error = await this.findOne(id);
    error.correctiveActions = error.correctiveActions
      ? `${error.correctiveActions}\n${action}`
      : action;
    return await this.errorRepository.save(error);
  }

  async addPreventiveAction(id: string, action: string): Promise<MedicationErrorLog> {
    const error = await this.findOne(id);
    error.preventiveActions = error.preventiveActions
      ? `${error.preventiveActions}\n${action}`
      : action;
    return await this.errorRepository.save(error);
  }

  async notifyPatient(id: string): Promise<MedicationErrorLog> {
    const error = await this.findOne(id);
    error.patientNotified = true;
    return await this.errorRepository.save(error);
  }

  async notifyPrescriber(id: string): Promise<MedicationErrorLog> {
    const error = await this.findOne(id);
    error.prescriberNotified = true;
    return await this.errorRepository.save(error);
  }

  async reportToFDA(id: string, fdaReportNumber: string): Promise<MedicationErrorLog> {
    const error = await this.findOne(id);
    error.reportedToFDA = true;
    error.fdaReportNumber = fdaReportNumber;
    return await this.errorRepository.save(error);
  }

  async reportToISMP(id: string): Promise<MedicationErrorLog> {
    const error = await this.findOne(id);
    error.reportedToISMP = true;
    return await this.errorRepository.save(error);
  }

  async closeError(id: string, followUpActions?: string): Promise<MedicationErrorLog> {
    const error = await this.findOne(id);
    error.status = 'closed';
    if (followUpActions) {
      error.followUpActions = followUpActions;
    }
    return await this.errorRepository.save(error);
  }

  async getErrorsByType(errorType: ErrorType): Promise<MedicationErrorLog[]> {
    return await this.errorRepository.find({
      where: { errorType },
      order: { reportedAt: 'DESC' },
    });
  }

  async getErrorsBySeverity(severity: ErrorSeverity): Promise<MedicationErrorLog[]> {
    return await this.errorRepository.find({
      where: { severity },
      order: { reportedAt: 'DESC' },
    });
  }

  async getOpenErrors(): Promise<MedicationErrorLog[]> {
    return await this.errorRepository.find({
      where: { status: 'open' },
      order: { reportedAt: 'ASC' },
    });
  }

  async getErrorsByDateRange(startDate: Date, endDate: Date): Promise<MedicationErrorLog[]> {
    return await this.errorRepository.find({
      where: {
        reportedAt: Between(startDate, endDate),
      },
      order: { reportedAt: 'DESC' },
    });
  }

  async getErrorStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalErrors: number;
    errorsByType: Array<{ type: ErrorType; count: number }>;
    errorsBySeverity: Array<{ severity: ErrorSeverity; count: number }>;
    errorsByStatus: Array<{ status: string; count: number }>;
    nearMissRate: number;
    harmfulErrorRate: number;
    topContributingFactors: Array<{ factor: string; count: number }>;
  }> {
    let query = this.errorRepository.createQueryBuilder('error');

    if (startDate && endDate) {
      query = query.where('error.reportedAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const errors = await query.getMany();
    const totalErrors = errors.length;

    // Count by type
    const typeCount = new Map<ErrorType, number>();
    Object.values(ErrorType).forEach((type) => typeCount.set(type, 0));
    errors.forEach((error) => {
      typeCount.set(error.errorType, (typeCount.get(error.errorType) || 0) + 1);
    });

    // Count by severity
    const severityCount = new Map<ErrorSeverity, number>();
    Object.values(ErrorSeverity).forEach((severity) => severityCount.set(severity, 0));
    errors.forEach((error) => {
      severityCount.set(error.severity, (severityCount.get(error.severity) || 0) + 1);
    });

    // Count by status
    const statusCount = new Map<string, number>();
    errors.forEach((error) => {
      statusCount.set(error.status, (statusCount.get(error.status) || 0) + 1);
    });

    // Calculate rates
    const nearMissCount = severityCount.get(ErrorSeverity.NEAR_MISS) || 0;
    const harmfulErrorCount = errors.filter((e) =>
      [
        ErrorSeverity.MINOR_HARM,
        ErrorSeverity.MODERATE_HARM,
        ErrorSeverity.SEVERE_HARM,
        ErrorSeverity.DEATH,
      ].includes(e.severity),
    ).length;

    const nearMissRate = totalErrors > 0 ? (nearMissCount / totalErrors) * 100 : 0;
    const harmfulErrorRate = totalErrors > 0 ? (harmfulErrorCount / totalErrors) * 100 : 0;

    // Top contributing factors
    const factorCount = new Map<string, number>();
    errors.forEach((error) => {
      if (error.contributingFactors) {
        // Simple word extraction - in production, this would be more sophisticated
        const factors = error.contributingFactors
          .toLowerCase()
          .split(/[,;.\n]/)
          .map((f) => f.trim())
          .filter((f) => f.length > 3);

        factors.forEach((factor) => {
          factorCount.set(factor, (factorCount.get(factor) || 0) + 1);
        });
      }
    });

    const topContributingFactors = Array.from(factorCount.entries())
      .map(([factor, count]) => ({ factor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors,
      errorsByType: Array.from(typeCount.entries()).map(([type, count]) => ({ type, count })),
      errorsBySeverity: Array.from(severityCount.entries()).map(([severity, count]) => ({
        severity,
        count,
      })),
      errorsByStatus: Array.from(statusCount.entries()).map(([status, count]) => ({
        status,
        count,
      })),
      nearMissRate,
      harmfulErrorRate,
      topContributingFactors,
    };
  }

  async getTrendAnalysis(months: number = 12): Promise<
    Array<{
      month: string;
      totalErrors: number;
      nearMisses: number;
      harmfulErrors: number;
    }>
  > {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const errors = await this.getErrorsByDateRange(startDate, endDate);

    // Group by month
    const monthlyData = new Map<
      string,
      {
        totalErrors: number;
        nearMisses: number;
        harmfulErrors: number;
      }
    >();

    errors.forEach((error) => {
      const monthKey = error.reportedAt.toISOString().substring(0, 7); // YYYY-MM

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { totalErrors: 0, nearMisses: 0, harmfulErrors: 0 });
      }

      const data = monthlyData.get(monthKey);
      data.totalErrors++;

      if (error.severity === ErrorSeverity.NEAR_MISS) {
        data.nearMisses++;
      } else if (
        [
          ErrorSeverity.MINOR_HARM,
          ErrorSeverity.MODERATE_HARM,
          ErrorSeverity.SEVERE_HARM,
          ErrorSeverity.DEATH,
        ].includes(error.severity)
      ) {
        data.harmfulErrors++;
      }
    });

    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}
