import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { QualityOutcome, OutcomeType, ComparisonResult } from '../entities/quality-outcome.entity';

export interface CreateOutcomeDto {
  patientId: string;
  providerId?: string;
  virtualVisitId?: string;
  outcomeType: OutcomeType;
  measurementDate: Date;
  metrics: any;
}

export interface OutcomeComparisonDto {
  telemedicineScore: number;
  inPersonScore: number;
  statisticalSignificance?: boolean;
  pValue?: number;
}

@Injectable()
export class QualityOutcomeService {
  constructor(
    @InjectRepository(QualityOutcome)
    private outcomeRepository: Repository<QualityOutcome>,
  ) {}

  async recordOutcome(dto: CreateOutcomeDto): Promise<QualityOutcome> {
    // Calculate normalized score
    const score = this.calculateNormalizedScore(dto.outcomeType, dto.metrics);

    // Get baseline data if exists
    const baselineData = await this.getBaselineData(dto.patientId, dto.outcomeType);

    // Calculate improvement
    let improvementPercentage = 0;
    if (baselineData) {
      improvementPercentage =
        ((score - baselineData.baselineScore) / baselineData.baselineScore) * 100;
    }

    const outcome = this.outcomeRepository.create({
      ...dto,
      score,
      baselineData,
      improvementPercentage: baselineData ? improvementPercentage : null,
      meetsQualityBenchmark: this.checkBenchmark(dto.outcomeType, score),
      benchmarkScore: this.getBenchmarkScore(dto.outcomeType),
      benchmarkSource: 'National Quality Forum',
    });

    return this.outcomeRepository.save(outcome);
  }

  async recordPatientSatisfaction(
    virtualVisitId: string,
    patientId: string,
    satisfaction: {
      overallSatisfaction: number;
      easeOfUse: number;
      communicationQuality: number;
      technicalQuality: number;
      wouldRecommend: boolean;
    },
  ): Promise<QualityOutcome> {
    return this.recordOutcome({
      patientId,
      virtualVisitId,
      outcomeType: OutcomeType.PATIENT_SATISFACTION,
      measurementDate: new Date(),
      metrics: satisfaction,
    });
  }

  async compareToInPersonCare(
    outcomeId: string,
    comparison: OutcomeComparisonDto,
  ): Promise<QualityOutcome> {
    const outcome = await this.findOne(outcomeId);

    let comparisonResult: ComparisonResult;
    const difference = comparison.telemedicineScore - comparison.inPersonScore;

    if (Math.abs(difference) < 5) {
      comparisonResult = ComparisonResult.EQUIVALENT_TO_IN_PERSON;
    } else if (difference > 0) {
      comparisonResult = ComparisonResult.BETTER_THAN_IN_PERSON;
    } else {
      comparisonResult = ComparisonResult.WORSE_THAN_IN_PERSON;
    }

    outcome.comparisonToInPerson = comparisonResult;
    outcome.inPersonComparisonData = {
      inPersonScore: comparison.inPersonScore,
      telemedicineScore: comparison.telemedicineScore,
      difference,
      statisticalSignificance: comparison.statisticalSignificance,
      pValue: comparison.pValue,
    };

    return this.outcomeRepository.save(outcome);
  }

  async getPatientOutcomes(
    patientId: string,
    outcomeType?: OutcomeType,
  ): Promise<QualityOutcome[]> {
    const whereClause: any = { patientId };

    if (outcomeType) {
      whereClause.outcomeType = outcomeType;
    }

    return this.outcomeRepository.find({
      where: whereClause,
      order: { measurementDate: 'DESC' },
    });
  }

  async getProviderQualityMetrics(
    providerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    const outcomes = await this.outcomeRepository.find({
      where: {
        providerId,
        measurementDate: Between(startDate, endDate),
      },
    });

    const metrics = {
      totalOutcomes: outcomes.length,
      averageScore: 0,
      patientSatisfactionAvg: 0,
      clinicalOutcomeSuccess: 0,
      benchmarkComplianceRate: 0,
      comparisonToInPerson: {
        better: 0,
        equivalent: 0,
        worse: 0,
      },
    };

    if (outcomes.length === 0) return metrics;

    // Calculate averages
    const scores = outcomes.filter((o) => o.score !== null).map((o) => o.score);
    metrics.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Patient satisfaction
    const satisfactionOutcomes = outcomes.filter(
      (o) => o.outcomeType === OutcomeType.PATIENT_SATISFACTION,
    );
    if (satisfactionOutcomes.length > 0) {
      const satisfactionScores = satisfactionOutcomes.map((o) => o.score);
      metrics.patientSatisfactionAvg =
        satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length;
    }

    // Clinical outcomes
    const clinicalOutcomes = outcomes.filter((o) => o.outcomeType === OutcomeType.CLINICAL_OUTCOME);
    const successfulOutcomes = clinicalOutcomes.filter(
      (o) => o.metrics.targetMetricAchieved,
    ).length;
    metrics.clinicalOutcomeSuccess =
      clinicalOutcomes.length > 0 ? (successfulOutcomes / clinicalOutcomes.length) * 100 : 0;

    // Benchmark compliance
    const benchmarkCompliant = outcomes.filter((o) => o.meetsQualityBenchmark).length;
    metrics.benchmarkComplianceRate = (benchmarkCompliant / outcomes.length) * 100;

    // Comparison counts
    outcomes.forEach((o) => {
      if (o.comparisonToInPerson === ComparisonResult.BETTER_THAN_IN_PERSON) {
        metrics.comparisonToInPerson.better++;
      } else if (o.comparisonToInPerson === ComparisonResult.EQUIVALENT_TO_IN_PERSON) {
        metrics.comparisonToInPerson.equivalent++;
      } else if (o.comparisonToInPerson === ComparisonResult.WORSE_THAN_IN_PERSON) {
        metrics.comparisonToInPerson.worse++;
      }
    });

    return metrics;
  }

  async generateQualityReport(startDate: Date, endDate: Date, providerId?: string): Promise<any> {
    const whereClause: any = {
      measurementDate: Between(startDate, endDate),
    };

    if (providerId) {
      whereClause.providerId = providerId;
    }

    const outcomes = await this.outcomeRepository.find({
      where: whereClause,
    });

    const report = {
      period: { startDate, endDate },
      totalMeasurements: outcomes.length,
      overallQualityScore: 0,
      outcomesByType: {},
      benchmarkComparison: {
        meetingBenchmarks: 0,
        notMeetingBenchmarks: 0,
      },
      telemedicineVsInPerson: {
        equivalent: 0,
        better: 0,
        worse: 0,
        notCompared: 0,
      },
      adverseEvents: {
        total: 0,
        relatedToTelemedicine: 0,
      },
      patientSatisfaction: {
        average: 0,
        wouldRecommendRate: 0,
      },
    };

    // Group by outcome type
    const groupedOutcomes = outcomes.reduce(
      (acc, outcome) => {
        if (!acc[outcome.outcomeType]) {
          acc[outcome.outcomeType] = [];
        }
        acc[outcome.outcomeType].push(outcome);
        return acc;
      },
      {} as Record<string, QualityOutcome[]>,
    );

    // Calculate statistics for each type
    for (const [type, typeOutcomes] of Object.entries(groupedOutcomes)) {
      const scores = typeOutcomes.filter((o) => o.score !== null).map((o) => o.score);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      report.outcomesByType[type] = {
        count: typeOutcomes.length,
        averageScore: Math.round(avgScore * 10) / 10,
      };
    }

    // Overall quality score
    const allScores = outcomes.filter((o) => o.score !== null).map((o) => o.score);
    report.overallQualityScore =
      allScores.length > 0
        ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
        : 0;

    // Benchmark comparison
    report.benchmarkComparison.meetingBenchmarks = outcomes.filter(
      (o) => o.meetsQualityBenchmark,
    ).length;
    report.benchmarkComparison.notMeetingBenchmarks = outcomes.filter(
      (o) => !o.meetsQualityBenchmark,
    ).length;

    // Telemedicine vs In-person
    outcomes.forEach((o) => {
      if (o.comparisonToInPerson === ComparisonResult.EQUIVALENT_TO_IN_PERSON) {
        report.telemedicineVsInPerson.equivalent++;
      } else if (o.comparisonToInPerson === ComparisonResult.BETTER_THAN_IN_PERSON) {
        report.telemedicineVsInPerson.better++;
      } else if (o.comparisonToInPerson === ComparisonResult.WORSE_THAN_IN_PERSON) {
        report.telemedicineVsInPerson.worse++;
      } else {
        report.telemedicineVsInPerson.notCompared++;
      }
    });

    // Adverse events
    report.adverseEvents.total = outcomes.filter((o) => o.hadAdverseEvent).length;
    report.adverseEvents.relatedToTelemedicine = outcomes.filter(
      (o) => o.hadAdverseEvent && o.relatedToTelemedicine,
    ).length;

    // Patient satisfaction
    const satisfactionOutcomes = outcomes.filter(
      (o) => o.outcomeType === OutcomeType.PATIENT_SATISFACTION,
    );
    if (satisfactionOutcomes.length > 0) {
      const satisfactionScores = satisfactionOutcomes.map((o) => o.score);
      report.patientSatisfaction.average =
        satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length;

      const recommendCount = satisfactionOutcomes.filter(
        (o) => o.metrics.wouldRecommend === true,
      ).length;
      report.patientSatisfaction.wouldRecommendRate =
        (recommendCount / satisfactionOutcomes.length) * 100;
    }

    return report;
  }

  async recordAdverseEvent(
    outcomeId: string,
    eventDescription: string,
    severity: string,
    relatedToTelemedicine: boolean,
  ): Promise<QualityOutcome> {
    const outcome = await this.findOne(outcomeId);

    outcome.hadAdverseEvent = true;
    outcome.adverseEventDescription = eventDescription;
    outcome.adverseEventSeverity = severity;
    outcome.relatedToTelemedicine = relatedToTelemedicine;

    return this.outcomeRepository.save(outcome);
  }

  async validateOutcome(outcomeId: string, validatedBy: string): Promise<QualityOutcome> {
    const outcome = await this.findOne(outcomeId);

    outcome.isValidated = true;
    outcome.validatedBy = validatedBy;
    outcome.validatedAt = new Date();

    return this.outcomeRepository.save(outcome);
  }

  private calculateNormalizedScore(outcomeType: OutcomeType, metrics: any): number {
    switch (outcomeType) {
      case OutcomeType.PATIENT_SATISFACTION:
        // Average of all satisfaction metrics (1-5 scale) normalized to 0-100
        const satisfactionScores = [
          metrics.overallSatisfaction,
          metrics.easeOfUse,
          metrics.communicationQuality,
          metrics.technicalQuality,
        ].filter((s) => s !== undefined);

        const avg = satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length;
        return (avg / 5) * 100;

      case OutcomeType.CLINICAL_OUTCOME:
        if (metrics.targetMetricAchieved) return 100;
        if (metrics.symptomImprovement) return metrics.symptomImprovement;
        return 50;

      case OutcomeType.QUALITY_OF_LIFE:
        // Average QoL metrics (1-10 scale) normalized to 0-100
        const qolScores = [
          metrics.physicalHealth,
          metrics.mentalHealth,
          metrics.socialFunctioning,
        ].filter((s) => s !== undefined);

        if (qolScores.length === 0) return 50;

        const qolAvg = qolScores.reduce((a, b) => a + b, 0) / qolScores.length;
        return (qolAvg / 10) * 100;

      case OutcomeType.MEDICATION_ADHERENCE:
        return metrics.adherenceRate || 0;

      default:
        return 50; // Default middle score
    }
  }

  private async getBaselineData(patientId: string, outcomeType: OutcomeType): Promise<any | null> {
    const baselineOutcome = await this.outcomeRepository.findOne({
      where: { patientId, outcomeType },
      order: { measurementDate: 'ASC' },
    });

    if (!baselineOutcome) return null;

    return {
      measurementDate: baselineOutcome.measurementDate,
      baselineScore: baselineOutcome.score,
      baselineMetrics: baselineOutcome.metrics,
    };
  }

  private checkBenchmark(outcomeType: OutcomeType, score: number): boolean {
    const benchmarkScore = this.getBenchmarkScore(outcomeType);
    return score >= benchmarkScore;
  }

  private getBenchmarkScore(outcomeType: OutcomeType): number {
    // National benchmarks (simplified)
    const benchmarks = {
      [OutcomeType.PATIENT_SATISFACTION]: 80,
      [OutcomeType.CLINICAL_OUTCOME]: 75,
      [OutcomeType.QUALITY_OF_LIFE]: 70,
      [OutcomeType.MEDICATION_ADHERENCE]: 80,
      [OutcomeType.FOLLOW_UP_COMPLIANCE]: 85,
    };

    return benchmarks[outcomeType] || 70;
  }

  async findOne(id: string): Promise<QualityOutcome> {
    const outcome = await this.outcomeRepository.findOne({ where: { id } });

    if (!outcome) {
      throw new NotFoundException(`Quality outcome with ID ${id} not found`);
    }

    return outcome;
  }
}
