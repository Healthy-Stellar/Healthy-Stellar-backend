import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OutcomeType {
  PATIENT_SATISFACTION = 'patient_satisfaction',
  CLINICAL_OUTCOME = 'clinical_outcome',
  READMISSION_RATE = 'readmission_rate',
  MEDICATION_ADHERENCE = 'medication_adherence',
  FOLLOW_UP_COMPLIANCE = 'follow_up_compliance',
  SYMPTOM_IMPROVEMENT = 'symptom_improvement',
  QUALITY_OF_LIFE = 'quality_of_life',
  COST_EFFECTIVENESS = 'cost_effectiveness',
}

export enum ComparisonResult {
  BETTER_THAN_IN_PERSON = 'better_than_in_person',
  EQUIVALENT_TO_IN_PERSON = 'equivalent_to_in_person',
  WORSE_THAN_IN_PERSON = 'worse_than_in_person',
  NOT_COMPARED = 'not_compared',
}

@Entity('quality_outcomes')
@Index(['patientId', 'measurementDate'])
@Index(['outcomeType', 'measurementDate'])
export class QualityOutcome {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ type: 'uuid', nullable: true })
  providerId: string;

  @Column({ type: 'uuid', nullable: true })
  virtualVisitId: string;

  @Column({
    type: 'enum',
    enum: OutcomeType,
  })
  outcomeType: OutcomeType;

  @Column({ type: 'date' })
  @Index()
  measurementDate: Date;

  @Column({ type: 'jsonb' })
  metrics: {
    // Patient Satisfaction
    overallSatisfaction?: number; // 1-5 scale
    easeOfUse?: number;
    communicationQuality?: number;
    technicalQuality?: number;
    wouldRecommend?: boolean;

    // Clinical Outcomes
    symptomResolution?: boolean;
    symptomImprovement?: number; // percentage
    targetMetricAchieved?: boolean;
    adverseEvents?: number;

    // Quality of Life
    physicalHealth?: number; // 1-10 scale
    mentalHealth?: number;
    socialFunctioning?: number;
    painLevel?: number;

    // Cost Effectiveness
    costSavings?: number;
    timesSaved?: number; // minutes
    travelDistanceAvoided?: number; // miles

    // Specific measurements
    customMetrics?: Record<string, any>;
  };

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score: number; // 0-100 normalized score

  @Column({ type: 'jsonb', nullable: true })
  baselineData: {
    measurementDate?: Date;
    baselineScore?: number;
    baselineMetrics?: any;
  };

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  improvementPercentage: number;

  @Column({
    type: 'enum',
    enum: ComparisonResult,
    default: ComparisonResult.NOT_COMPARED,
  })
  comparisonToInPerson: ComparisonResult;

  @Column({ type: 'jsonb', nullable: true })
  inPersonComparisonData: {
    inPersonScore?: number;
    telemedicineScore?: number;
    difference?: number;
    statisticalSignificance?: boolean;
    pValue?: number;
  };

  @Column({ type: 'text', nullable: true })
  clinicalNotes: string;

  @Column({ type: 'jsonb', nullable: true })
  patientReportedOutcomes: {
    question: string;
    answer: string | number | boolean;
    scale?: string;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  qualityIndicators: {
    indicator: string;
    met: boolean;
    target?: number;
    actual?: number;
  }[];

  @Column({ type: 'boolean', default: false })
  meetsQualityBenchmark: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  benchmarkScore: number;

  @Column({ type: 'varchar', nullable: true })
  benchmarkSource: string;

  @Column({ type: 'boolean', default: false })
  hadAdverseEvent: boolean;

  @Column({ type: 'text', nullable: true })
  adverseEventDescription: string;

  @Column({ type: 'varchar', nullable: true })
  adverseEventSeverity: string;

  @Column({ type: 'boolean', default: false })
  relatedToTelemedicine: boolean;

  @Column({ type: 'boolean', default: false })
  requiresFollowUp: boolean;

  @Column({ type: 'date', nullable: true })
  nextFollowUpDate: Date;

  @Column({ type: 'boolean', default: false })
  followUpCompleted: boolean;

  @Column({ type: 'date', nullable: true })
  followUpCompletedDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  riskAdjustmentFactors: {
    factor: string;
    weight: number;
  }[];

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  riskAdjustedScore: number;

  @Column({ type: 'varchar', nullable: true })
  measurementMethod: string;

  @Column({ type: 'boolean', default: true })
  isValidated: boolean;

  @Column({ type: 'uuid', nullable: true })
  validatedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  validatedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  populationAverages: {
    national?: number;
    regional?: number;
    specialty?: number;
  };

  @Column({ type: 'text', nullable: true })
  improvementRecommendations: string;

  @Column({ type: 'jsonb', nullable: true })
  trendAnalysis: {
    direction: 'improving' | 'declining' | 'stable';
    changeRate?: number;
    predictionNextPeriod?: number;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
