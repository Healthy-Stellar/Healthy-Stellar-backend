import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataQualityReport as DataQualityReportEntity } from '../entities/medical-validation.entities';
import {
  DataQualityReport,
  DataQualityScore,
  DataQualityIssue,
} from '../interfaces/validation-result.interface';
import { DataQualityDimension } from '../medical-codes.constants';

interface QualityCheckConfig {
  requiredFields?: string[];
  fieldTypes?: Record<string, string>;
  dateFields?: string[];
  codeFields?: Record<string, string>; // field -> code system
  passingThreshold?: number;
}

const RECORD_TYPE_CONFIGS: Record<string, QualityCheckConfig> = {
  encounter: {
    requiredFields: ['patientId', 'providerId', 'encounterDate', 'facilityId', 'diagnosisCodes'],
    dateFields: ['encounterDate', 'dischargeDate'],
    codeFields: { diagnosisCodes: 'ICD-10', procedureCodes: 'CPT' },
    passingThreshold: 75,
  },
  lab_result: {
    requiredFields: ['patientId', 'orderedBy', 'loincCode', 'value', 'unit', 'collectedAt'],
    dateFields: ['collectedAt', 'resultedAt'],
    codeFields: { loincCode: 'LOINC' },
    passingThreshold: 80,
  },
  medication: {
    requiredFields: ['patientId', 'prescriberId', 'ndcCode', 'dose', 'frequency', 'startDate'],
    dateFields: ['startDate', 'endDate'],
    codeFields: { ndcCode: 'NDC' },
    passingThreshold: 85,
  },
  vital_signs: {
    requiredFields: ['patientId', 'recordedAt', 'recordedBy'],
    dateFields: ['recordedAt'],
    passingThreshold: 70,
  },
};

@Injectable()
export class ClinicalDataQualityService {
  private readonly logger = new Logger(ClinicalDataQualityService.name);

  constructor(
    @InjectRepository(DataQualityReportEntity)
    private readonly qualityReportRepo: Repository<DataQualityReportEntity>,
  ) {}

  async assessQuality(
    recordId: string,
    recordType: string,
    data: Record<string, unknown>,
    customRequiredFields?: string[],
  ): Promise<DataQualityReport> {
    const config = RECORD_TYPE_CONFIGS[recordType] || {};
    const requiredFields = customRequiredFields || config.requiredFields || [];
    const threshold = config.passingThreshold || 70;

    const qualityScores: DataQualityScore[] = [
      this.assessCompleteness(data, requiredFields),
      this.assessValidity(data, config),
      this.assessConsistency(data, config),
      this.assessTimeliness(data, config.dateFields || []),
      this.assessAccuracy(data, config),
      this.assessUniqueness(recordId, data),
    ];

    const allIssues = qualityScores.flatMap((s) => s.issues);
    const overallScore = this.computeWeightedScore(qualityScores);
    const isPassing = overallScore >= threshold;

    const report: DataQualityReport = {
      recordId,
      recordType,
      overallScore,
      qualityScores,
      issues: allIssues,
      isPassing,
      assessedAt: new Date(),
    };

    // Persist the report
    await this.persistQualityReport(report, threshold);

    return report;
  }

  async getQualityTrend(
    recordType: string,
    days: number = 30,
  ): Promise<{
    averageScore: number;
    trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    recentReports: { date: Date; score: number }[];
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const reports = await this.qualityReportRepo
      .createQueryBuilder('r')
      .where('r.recordType = :recordType', { recordType })
      .andWhere('r.assessedAt >= :since', { since })
      .orderBy('r.assessedAt', 'ASC')
      .select(['r.assessedAt', 'r.overallScore'])
      .getMany();

    if (reports.length === 0) {
      return { averageScore: 0, trend: 'STABLE', recentReports: [] };
    }

    const scores = reports.map((r) => Number(r.overallScore));
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Determine trend from first half vs second half
    const midpoint = Math.floor(scores.length / 2);
    const firstHalfAvg = scores.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint || 0;
    const secondHalfAvg =
      scores.slice(midpoint).reduce((a, b) => a + b, 0) / (scores.length - midpoint);

    let trend: 'IMPROVING' | 'DECLINING' | 'STABLE' = 'STABLE';
    if (secondHalfAvg - firstHalfAvg > 2) trend = 'IMPROVING';
    else if (firstHalfAvg - secondHalfAvg > 2) trend = 'DECLINING';

    return {
      averageScore: Math.round(averageScore * 100) / 100,
      trend,
      recentReports: reports.map((r) => ({ date: r.assessedAt, score: Number(r.overallScore) })),
    };
  }

  private assessCompleteness(
    data: Record<string, unknown>,
    requiredFields: string[],
  ): DataQualityScore {
    const issues: DataQualityIssue[] = [];
    let presentCount = 0;

    for (const field of requiredFields) {
      const value = data[field];
      if (value === undefined || value === null || value === '') {
        issues.push({
          field,
          issueType: 'MISSING_REQUIRED_FIELD',
          severity: 'ERROR',
          message: `Required field "${field}" is missing or empty.`,
          suggestedFix: `Provide a value for "${field}".`,
        });
      } else {
        presentCount++;
      }
    }

    const score = requiredFields.length > 0 ? (presentCount / requiredFields.length) * 100 : 100;

    return {
      dimension: DataQualityDimension.COMPLETENESS,
      score: Math.round(score),
      weight: 0.3,
      issues,
    };
  }

  private assessValidity(
    data: Record<string, unknown>,
    config: QualityCheckConfig,
  ): DataQualityScore {
    const issues: DataQualityIssue[] = [];
    let validCount = 0;
    let totalChecked = 0;

    // Date field validation
    for (const dateField of config.dateFields || []) {
      if (data[dateField]) {
        totalChecked++;
        const dateValue = new Date(data[dateField] as string);
        if (isNaN(dateValue.getTime())) {
          issues.push({
            field: dateField,
            issueType: 'INVALID_DATE',
            severity: 'ERROR',
            message: `Field "${dateField}" contains an invalid date value: "${data[dateField]}"`,
            suggestedFix: 'Provide date in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss).',
          });
        } else {
          validCount++;
          // Future date check for most fields (except projected dates)
          if (dateValue > new Date()) {
            issues.push({
              field: dateField,
              issueType: 'FUTURE_DATE',
              severity: 'WARNING',
              message: `Field "${dateField}" contains a future date. Verify this is correct.`,
            });
          }
        }
      }
    }

    const score = totalChecked > 0 ? (validCount / totalChecked) * 100 : 100;

    return {
      dimension: DataQualityDimension.VALIDITY,
      score: Math.round(score),
      weight: 0.25,
      issues,
    };
  }

  private assessConsistency(
    data: Record<string, unknown>,
    config: QualityCheckConfig,
  ): DataQualityScore {
    const issues: DataQualityIssue[] = [];

    // Check date order consistency
    const encounterDate = data['encounterDate'] ? new Date(data['encounterDate'] as string) : null;
    const dischargeDate = data['dischargeDate'] ? new Date(data['dischargeDate'] as string) : null;

    if (encounterDate && dischargeDate && dischargeDate < encounterDate) {
      issues.push({
        field: 'dischargeDate',
        issueType: 'DATE_ORDER_INCONSISTENCY',
        severity: 'ERROR',
        message: 'Discharge date cannot be before encounter date.',
        suggestedFix: 'Verify encounter and discharge dates are in the correct order.',
      });
    }

    // Check collected/resulted date order for labs
    const collectedAt = data['collectedAt'] ? new Date(data['collectedAt'] as string) : null;
    const resultedAt = data['resultedAt'] ? new Date(data['resultedAt'] as string) : null;

    if (collectedAt && resultedAt && resultedAt < collectedAt) {
      issues.push({
        field: 'resultedAt',
        issueType: 'DATE_ORDER_INCONSISTENCY',
        severity: 'ERROR',
        message: 'Result date cannot be before collection date.',
        suggestedFix: 'Verify collection and result timestamps.',
      });
    }

    const score = issues.filter((i) => i.severity === 'ERROR').length === 0 ? 100 : 60;

    return {
      dimension: DataQualityDimension.CONSISTENCY,
      score,
      weight: 0.2,
      issues,
    };
  }

  private assessTimeliness(data: Record<string, unknown>, dateFields: string[]): DataQualityScore {
    const issues: DataQualityIssue[] = [];
    const now = new Date();

    // Check if record appears stale (created/updated long ago)
    for (const field of dateFields) {
      if (data[field]) {
        const date = new Date(data[field] as string);
        const daysDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

        if (daysDiff > 365) {
          issues.push({
            field,
            issueType: 'STALE_DATA',
            severity: 'WARNING',
            message: `Field "${field}" is over 1 year old. Verify data is still current.`,
          });
        }
      }
    }

    const score = issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 15);

    return {
      dimension: DataQualityDimension.TIMELINESS,
      score,
      weight: 0.1,
      issues,
    };
  }

  private assessAccuracy(
    data: Record<string, unknown>,
    config: QualityCheckConfig,
  ): DataQualityScore {
    const issues: DataQualityIssue[] = [];

    // Numeric range checks
    if (data['age'] !== undefined) {
      const age = Number(data['age']);
      if (age < 0 || age > 150) {
        issues.push({
          field: 'age',
          issueType: 'OUT_OF_RANGE',
          severity: 'ERROR',
          message: `Age value "${age}" is outside valid range (0-150).`,
          suggestedFix: 'Verify patient age.',
        });
      }
    }

    if (data['weight'] !== undefined) {
      const weight = Number(data['weight']);
      if (weight < 0.5 || weight > 700) {
        issues.push({
          field: 'weight',
          issueType: 'OUT_OF_RANGE',
          severity: 'WARNING',
          message: `Weight value "${weight}" seems outside plausible range.`,
          suggestedFix: 'Verify weight and unit of measure.',
        });
      }
    }

    const score = issues.filter((i) => i.severity === 'ERROR').length === 0 ? 100 : 70;

    return {
      dimension: DataQualityDimension.ACCURACY,
      score,
      weight: 0.1,
      issues,
    };
  }

  private assessUniqueness(recordId: string, data: Record<string, unknown>): DataQualityScore {
    // In production this would check for duplicate records in DB
    const issues: DataQualityIssue[] = [];
    const score = 100; // Simplified - would require DB lookup

    return {
      dimension: DataQualityDimension.UNIQUENESS,
      score,
      weight: 0.05,
      issues,
    };
  }

  private computeWeightedScore(scores: DataQualityScore[]): number {
    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    const weightedSum = scores.reduce((sum, s) => sum + s.score * s.weight, 0);
    return Math.round((weightedSum / totalWeight) * 100) / 100;
  }

  private async persistQualityReport(report: DataQualityReport, threshold: number): Promise<void> {
    try {
      await this.qualityReportRepo.save({
        recordId: report.recordId,
        recordType: report.recordType,
        overallScore: report.overallScore,
        qualityScores: report.qualityScores as unknown as Record<string, unknown>[],
        issues: report.issues as unknown as Record<string, unknown>[],
        isPassing: report.isPassing,
        passingThreshold: threshold,
      });
    } catch (error) {
      this.logger.error('Failed to persist data quality report', error);
    }
  }
}
