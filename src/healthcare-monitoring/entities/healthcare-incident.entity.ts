import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum IncidentType {
  MEDICATION_ERROR = 'medication_error',
  PATIENT_FALL = 'patient_fall',
  EQUIPMENT_FAILURE = 'equipment_failure',
  INFECTION_CONTROL_BREACH = 'infection_control_breach',
  DATA_BREACH = 'data_breach',
  PATIENT_IDENTIFICATION_ERROR = 'patient_identification_error',
  SURGICAL_COMPLICATION = 'surgical_complication',
  ADVERSE_DRUG_REACTION = 'adverse_drug_reaction',
  SYSTEM_DOWNTIME = 'system_downtime',
  SECURITY_INCIDENT = 'security_incident',
}

export enum IncidentSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  CATASTROPHIC = 'catastrophic',
}

export enum IncidentStatus {
  REPORTED = 'reported',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

@Entity('healthcare_incidents')
@Index(['incidentType', 'severity'])
@Index(['status', 'reportedAt'])
@Index(['department', 'incidentType'])
export class HealthcareIncident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, unique: true })
  incidentNumber: string;

  @Column({
    type: 'enum',
    enum: IncidentType,
  })
  incidentType: IncidentType;

  @Column({
    type: 'enum',
    enum: IncidentSeverity,
  })
  severity: IncidentSeverity;

  @Column({
    type: 'enum',
    enum: IncidentStatus,
    default: IncidentStatus.REPORTED,
  })
  status: IncidentStatus;

  @Column({ length: 200 })
  title: string;

  @Column('text')
  description: string;

  @Column({ length: 100 })
  department: string;

  @Column({ length: 50, nullable: true })
  location: string;

  @Column('uuid', { nullable: true })
  patientId: string;

  @Column('uuid', { nullable: true })
  staffId: string;

  @Column('uuid', { nullable: true })
  equipmentId: string;

  @Column('uuid')
  reportedBy: string;

  @Column()
  reportedAt: Date;

  @Column('uuid', { nullable: true })
  assignedTo: string;

  @Column('uuid', { nullable: true })
  investigatedBy: string;

  @Column({ nullable: true })
  investigationStarted: Date;

  @Column({ nullable: true })
  investigationCompleted: Date;

  @Column('text', { nullable: true })
  rootCause: string;

  @Column('text', { nullable: true })
  correctiveActions: string;

  @Column('text', { nullable: true })
  preventiveActions: string;

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column('json', { nullable: true })
  attachments: string[];

  @Column('json', { nullable: true })
  witnesses: Record<string, any>[];

  @Column('json', { nullable: true })
  timeline: Record<string, any>[];

  @Column({ default: false })
  requiresRegulatoryCommunication: boolean;

  @Column('simple-array', { nullable: true })
  regulatoryBodies: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}