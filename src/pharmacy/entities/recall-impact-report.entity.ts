import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DrugRecall } from './drug-recall.entity';

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * RecallImpactReport
 *
 * One row per prescription affected by a drug recall.
 * Tracks whether the patient and prescriber were notified and the
 * outcome of each notification attempt.
 *
 * Used by:
 *  - RecallNotificationService   (writes rows, updates status)
 *  - GET /pharmacy/recalls/:id/impact  (reads rows for the admin dashboard)
 */
@Entity('recall_impact_reports')
export class RecallImpactReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DrugRecall, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recall_id' })
  recall: DrugRecall;

  @Column({ type: 'uuid', name: 'recall_id' })
  @Index()
  recallId: string;

  @Column({ type: 'uuid' })
  prescriptionId: string;

  @Column({ type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  prescriberId: string;

  @Column({ nullable: true })
  matchedNdcCode: string;

  @Column({ nullable: true })
  matchedLotNumber: string;

  // ── Patient notification ──────────────────────────────────────────────────

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
    name: 'patient_notification_status',
  })
  patientNotificationStatus: NotificationStatus;

  @Column({ type: 'timestamp', nullable: true, name: 'patient_notified_at' })
  patientNotifiedAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'patient_notification_error' })
  patientNotificationError: string | null;

  // ── Prescriber notification ───────────────────────────────────────────────

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
    name: 'prescriber_notification_status',
  })
  prescriberNotificationStatus: NotificationStatus;

  @Column({ type: 'timestamp', nullable: true, name: 'prescriber_notified_at' })
  prescriberNotifiedAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'prescriber_notification_error' })
  prescriberNotificationError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
