import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ErrorType {
  WRONG_DRUG = 'wrong_drug',
  WRONG_DOSE = 'wrong_dose',
  WRONG_PATIENT = 'wrong_patient',
  WRONG_ROUTE = 'wrong_route',
  WRONG_TIME = 'wrong_time',
  OMISSION = 'omission',
  DUPLICATE = 'duplicate',
  CONTRAINDICATION = 'contraindication',
  ALLERGY = 'allergy',
  INTERACTION = 'interaction',
  LABELING = 'labeling',
  OTHER = 'other',
}

export enum ErrorSeverity {
  NEAR_MISS = 'near_miss',
  NO_HARM = 'no_harm',
  MINOR_HARM = 'minor_harm',
  MODERATE_HARM = 'moderate_harm',
  SEVERE_HARM = 'severe_harm',
  DEATH = 'death',
}

@Entity('medication_error_logs')
export class MedicationErrorLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  errorNumber: string;

  @Column({
    type: 'enum',
    enum: ErrorType,
  })
  errorType: ErrorType;

  @Column({
    type: 'enum',
    enum: ErrorSeverity,
  })
  severity: ErrorSeverity;

  @Column()
  prescriptionId: string;

  @Column({ nullable: true })
  drugId: string;

  @Column({ nullable: true })
  drugName: string;

  @Column()
  patientId: string;

  @Column()
  patientName: string;

  @Column('text')
  errorDescription: string;

  @Column('text', { nullable: true })
  contributingFactors: string;

  @Column()
  reportedBy: string;

  @Column()
  reporterRole: string; // pharmacist, technician, nurse, etc.

  @Column({ nullable: true })
  discoveredBy: string;

  @Column({ type: 'timestamp', nullable: true })
  discoveredAt: Date;

  @Column('text', { nullable: true })
  correctiveActions: string;

  @Column('text', { nullable: true })
  preventiveActions: string;

  @Column({ default: false })
  patientNotified: boolean;

  @Column({ default: false })
  prescriberNotified: boolean;

  @Column({ default: false })
  reportedToFDA: boolean;

  @Column({ nullable: true })
  fdaReportNumber: string;

  @Column({ default: false })
  reportedToISMP: boolean; // Institute for Safe Medication Practices

  @Column('text', { nullable: true })
  followUpActions: string;

  @Column({ type: 'enum', enum: ['open', 'investigating', 'resolved', 'closed'] })
  status: string;

  @CreateDateColumn()
  occurredAt: Date;

  @CreateDateColumn()
  reportedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
