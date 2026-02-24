import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity';

export enum ReconciliationType {
  ADMISSION = 'admission',
  TRANSFER = 'transfer',
  DISCHARGE = 'discharge',
  PROCEDURE = 'procedure',
}

export enum ReconciliationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REQUIRES_REVIEW = 'requires_review',
}

export enum MedicationAction {
  CONTINUE = 'continue',
  DISCONTINUE = 'discontinue',
  MODIFY = 'modify',
  ADD = 'add',
  HOLD = 'hold',
}

@Entity('medication_reconciliations')
@Index(['patientId', 'reconciliationType'])
@Index(['status', 'createdAt'])
@Index(['pharmacistId'])
export class MedicationReconciliation extends BaseAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId: string;

  @Column({
    name: 'reconciliation_type',
    type: 'enum',
    enum: ReconciliationType,
  })
  @Index()
  reconciliationType: ReconciliationType;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.PENDING,
  })
  @Index()
  status: ReconciliationStatus;

  @Column({ name: 'initiated_by', type: 'uuid' })
  initiatedBy: string;

  @Column({ name: 'initiated_by_name', length: 255 })
  initiatedByName: string;

  @Column({ name: 'initiated_by_role', length: 100 })
  initiatedByRole: string;

  @Column({ name: 'pharmacist_id', type: 'uuid', nullable: true })
  @Index()
  pharmacistId: string;

  @Column({ name: 'pharmacist_name', length: 255, nullable: true })
  pharmacistName: string;

  @Column({ name: 'physician_id', type: 'uuid', nullable: true })
  physicianId: string;

  @Column({ name: 'physician_name', length: 255, nullable: true })
  physicianName: string;

  @Column({ name: 'home_medications', type: 'json', nullable: true })
  homeMedications: any[];

  @Column({ name: 'current_medications', type: 'json', nullable: true })
  currentMedications: any[];

  @Column({ name: 'reconciled_medications', type: 'json', nullable: true })
  reconciledMedications: any[];

  @Column({ name: 'discrepancies_found', type: 'json', nullable: true })
  discrepanciesFound: any[];

  @Column({ name: 'actions_taken', type: 'json', nullable: true })
  actionsTaken: any[];

  @Column({ name: 'allergies_reviewed', type: 'boolean', default: false })
  allergiesReviewed: boolean;

  @Column({ name: 'drug_interactions_checked', type: 'boolean', default: false })
  drugInteractionsChecked: boolean;

  @Column({ name: 'duplicate_therapy_checked', type: 'boolean', default: false })
  duplicateTherapyChecked: boolean;

  @Column({ name: 'renal_dosing_checked', type: 'boolean', default: false })
  renalDosingChecked: boolean;

  @Column({ name: 'hepatic_dosing_checked', type: 'boolean', default: false })
  hepaticDosingChecked: boolean;

  @Column({ name: 'reconciliation_notes', type: 'text', nullable: true })
  reconciliationNotes: string;

  @Column({ name: 'patient_interview_completed', type: 'boolean', default: false })
  patientInterviewCompleted: boolean;

  @Column({ name: 'family_interview_completed', type: 'boolean', default: false })
  familyInterviewCompleted: boolean;

  @Column({ name: 'pharmacy_contacted', type: 'boolean', default: false })
  pharmacyContacted: boolean;

  @Column({ name: 'primary_care_contacted', type: 'boolean', default: false })
  primaryCareContacted: boolean;

  @Column({ name: 'medication_list_provided', type: 'boolean', default: false })
  medicationListProvided: boolean;

  @Column({ name: 'patient_education_completed', type: 'boolean', default: false })
  patientEducationCompleted: boolean;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ name: 'completed_by', type: 'uuid', nullable: true })
  completedBy: string;

  @Column({ name: 'review_required_reason', type: 'text', nullable: true })
  reviewRequiredReason: string;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
