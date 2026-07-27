import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DrugRecall } from './drug-recall.entity';

@Entity('recall_impact_reports')
export class RecallImpactReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  recallId: string;

  @ManyToOne(() => DrugRecall, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recall_id' })
  recall: DrugRecall;

  @Column({ type: 'int', default: 0 })
  affectedPrescriptionCount: number;

  @Column({ type: 'int', default: 0 })
  affectedPatientsCount: number;

  @Column({ type: 'int', default: 0 })
  affectedPrescribersCount: number;

  @Column({ type: 'simple-array', nullable: true })
  affectedPatientIds: string[];

  @Column({ type: 'simple-array', nullable: true })
  affectedPrescriberIds: string[];

  @Column({ type: 'simple-json', nullable: true })
  notificationSummary: Array<{
    recipientId: string;
    recipientType: 'patient' | 'provider';
    method: string;
    status: 'queued' | 'sent' | 'failed';
    note?: string;
    attemptedAt: string;
  }>;

  @CreateDateColumn()
  createdAt: Date;
}
