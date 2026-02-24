import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { MedicationAdministrationRecord } from './medication-administration-record.entity';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity';

export enum ReactionSeverity {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  LIFE_THREATENING = 'life_threatening',
}

export enum ReactionType {
  ALLERGIC = 'allergic',
  SIDE_EFFECT = 'side_effect',
  DRUG_INTERACTION = 'drug_interaction',
  OVERDOSE = 'overdose',
  WITHDRAWAL = 'withdrawal',
  OTHER = 'other',
}

export enum ReactionStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  ONGOING = 'ongoing',
  UNKNOWN = 'unknown',
}

@Entity('adverse_drug_reactions')
@Index(['patientId', 'reactionDate'])
@Index(['severity', 'status'])
@Index(['medicationName'])
export class AdverseDrugReaction extends BaseAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MedicationAdministrationRecord, { nullable: true })
  @JoinColumn({ name: 'mar_id' })
  medicationAdministrationRecord: MedicationAdministrationRecord;

  @Column({ name: 'mar_id', type: 'uuid', nullable: true })
  marId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ name: 'medication_name', length: 255 })
  @Index()
  medicationName: string;

  @Column({ name: 'medication_id', type: 'uuid', nullable: true })
  medicationId: string;

  @Column({ name: 'dosage', length: 100, nullable: true })
  dosage: string;

  @Column({ name: 'reaction_date', type: 'timestamp' })
  @Index()
  reactionDate: Date;

  @Column({
    name: 'severity',
    type: 'enum',
    enum: ReactionSeverity,
  })
  @Index()
  severity: ReactionSeverity;

  @Column({
    name: 'reaction_type',
    type: 'enum',
    enum: ReactionType,
  })
  reactionType: ReactionType;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ReactionStatus,
    default: ReactionStatus.ACTIVE,
  })
  @Index()
  status: ReactionStatus;

  @Column({ name: 'symptoms', type: 'text' })
  symptoms: string;

  @Column({ name: 'onset_time', length: 100, nullable: true })
  onsetTime: string;

  @Column({ name: 'duration', length: 100, nullable: true })
  duration: string;

  @Column({ name: 'treatment_given', type: 'text', nullable: true })
  treatmentGiven: string;

  @Column({ name: 'outcome', type: 'text', nullable: true })
  outcome: string;

  @Column({ name: 'reporter_id', type: 'uuid' })
  reporterId: string;

  @Column({ name: 'reporter_name', length: 255 })
  reporterName: string;

  @Column({ name: 'reporter_role', length: 100 })
  reporterRole: string;

  @Column({ name: 'physician_notified', type: 'boolean', default: false })
  physicianNotified: boolean;

  @Column({ name: 'physician_notification_time', type: 'timestamp', nullable: true })
  physicianNotificationTime: Date;

  @Column({ name: 'pharmacy_notified', type: 'boolean', default: false })
  pharmacyNotified: boolean;

  @Column({ name: 'pharmacy_notification_time', type: 'timestamp', nullable: true })
  pharmacyNotificationTime: Date;

  @Column({ name: 'fda_reported', type: 'boolean', default: false })
  fdaReported: boolean;

  @Column({ name: 'fda_report_number', length: 100, nullable: true })
  fdaReportNumber: string;

  @Column({ name: 'medication_discontinued', type: 'boolean', default: false })
  medicationDiscontinued: boolean;

  @Column({ name: 'discontinuation_date', type: 'timestamp', nullable: true })
  discontinuationDate: Date;

  @Column({ name: 'rechallenge_attempted', type: 'boolean', default: false })
  rechallengeAttempted: boolean;

  @Column({ name: 'rechallenge_result', type: 'text', nullable: true })
  rechallengeResult: string;

  @Column({ name: 'concomitant_medications', type: 'text', nullable: true })
  concomitantMedications: string;

  @Column({ name: 'medical_history_relevant', type: 'text', nullable: true })
  medicalHistoryRelevant: string;

  @Column({ name: 'lab_values', type: 'text', nullable: true })
  labValues: string;

  @Column({ name: 'follow_up_required', type: 'boolean', default: false })
  followUpRequired: boolean;

  @Column({ name: 'follow_up_date', type: 'date', nullable: true })
  followUpDate: Date;

  @Column({ name: 'resolved_date', type: 'timestamp', nullable: true })
  resolvedDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
