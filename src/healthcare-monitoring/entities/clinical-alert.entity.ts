import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum AlertType {
  CRITICAL_VITALS = 'critical_vitals',
  MEDICATION_DUE = 'medication_due',
  LAB_RESULTS_ABNORMAL = 'lab_results_abnormal',
  EQUIPMENT_MALFUNCTION = 'equipment_malfunction',
  PATIENT_DETERIORATION = 'patient_deterioration',
  INFECTION_CONTROL = 'infection_control',
  EMERGENCY_CODE = 'emergency_code',
  REGULATORY_VIOLATION = 'regulatory_violation',
}

export enum AlertPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
}

@Entity('clinical_alerts')
@Index(['alertType', 'priority', 'status'])
@Index(['patientId', 'status'])
@Index(['createdAt', 'priority'])
export class ClinicalAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AlertType,
  })
  alertType: AlertType;

  @Column({
    type: 'enum',
    enum: AlertPriority,
  })
  priority: AlertPriority;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.ACTIVE,
  })
  status: AlertStatus;

  @Column({ length: 200 })
  title: string;

  @Column('text')
  message: string;

  @Column('uuid', { nullable: true })
  patientId: string;

  @Column({ length: 100, nullable: true })
  department: string;

  @Column({ length: 50, nullable: true })
  room: string;

  @Column('uuid', { nullable: true })
  equipmentId: string;

  @Column('uuid', { nullable: true })
  assignedTo: string;

  @Column('uuid', { nullable: true })
  acknowledgedBy: string;

  @Column({ nullable: true })
  acknowledgedAt: Date;

  @Column('uuid', { nullable: true })
  resolvedBy: string;

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column('text', { nullable: true })
  resolutionNotes: string;

  @Column('json', { nullable: true })
  alertData: Record<string, any>;

  @Column('simple-array', { nullable: true })
  notificationChannels: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}