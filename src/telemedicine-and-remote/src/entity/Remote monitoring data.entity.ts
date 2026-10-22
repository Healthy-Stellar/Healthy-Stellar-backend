import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum MonitoringDataType {
  VITAL_SIGNS = 'vital_signs',
  BLOOD_GLUCOSE = 'blood_glucose',
  BLOOD_PRESSURE = 'blood_pressure',
  HEART_RATE = 'heart_rate',
  OXYGEN_SATURATION = 'oxygen_saturation',
  WEIGHT = 'weight',
  TEMPERATURE = 'temperature',
  ECG = 'ecg',
  SLEEP_PATTERN = 'sleep_pattern',
  ACTIVITY_LEVEL = 'activity_level',
  MEDICATION_ADHERENCE = 'medication_adherence',
  SYMPTOMS = 'symptoms',
}

export enum AlertLevel {
  NORMAL = 'normal',
  WARNING = 'warning',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency',
}

@Entity('remote_monitoring_data')
@Index(['patientId', 'recordedAt'])
@Index(['dataType', 'recordedAt'])
export class RemoteMonitoringData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ type: 'uuid', nullable: true })
  providerId: string;

  @Column({
    type: 'enum',
    enum: MonitoringDataType,
  })
  dataType: MonitoringDataType;

  @Column({ type: 'timestamp' })
  @Index()
  recordedAt: Date;

  @Column({ type: 'jsonb' })
  data: {
    // For vital signs
    systolic?: number;
    diastolic?: number;
    heartRate?: number;
    temperature?: number;
    oxygenSaturation?: number;
    respiratoryRate?: number;

    // For blood glucose
    glucoseLevel?: number;
    glucoseUnit?: string;
    mealContext?: string; // before_meal, after_meal, fasting

    // For weight
    weight?: number;
    weightUnit?: string;
    bmi?: number;

    // For symptoms
    symptomDescription?: string;
    severity?: number; // 1-10 scale

    // For medication adherence
    medicationName?: string;
    taken?: boolean;
    scheduledTime?: string;
    actualTime?: string;

    // For activity
    steps?: number;
    distance?: number;
    calories?: number;
    activeMinutes?: number;

    // For sleep
    sleepDuration?: number;
    sleepQuality?: number;

    // Raw device data
    rawData?: any;
  };

  @Column({
    type: 'enum',
    enum: AlertLevel,
    default: AlertLevel.NORMAL,
  })
  alertLevel: AlertLevel;

  @Column({ type: 'text', nullable: true })
  alertMessage: string;

  @Column({ type: 'boolean', default: false })
  requiresProviderReview: boolean;

  @Column({ type: 'boolean', default: false })
  reviewedByProvider: boolean;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'text', nullable: true })
  providerComments: string;

  @Column({ type: 'varchar', nullable: true })
  deviceId: string;

  @Column({ type: 'varchar', nullable: true })
  deviceType: string;

  @Column({ type: 'varchar', nullable: true })
  deviceManufacturer: string;

  @Column({ type: 'boolean', default: true })
  isAutomatedReading: boolean;

  @Column({ type: 'boolean', default: true })
  isValidated: boolean;

  @Column({ type: 'jsonb', nullable: true })
  validationErrors: string[];

  @Column({ type: 'jsonb', nullable: true })
  trend: {
    direction?: 'increasing' | 'decreasing' | 'stable';
    percentageChange?: number;
    comparisonPeriod?: string;
  };

  @Column({ type: 'uuid', nullable: true })
  relatedVisitId: string;

  @Column({ type: 'boolean', default: true })
  includeInReport: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    location?: string;
    timezone?: string;
    batteryLevel?: number;
    signalStrength?: number;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
