import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OutbreakThreshold } from './outbreak-threshold.entity';

export enum OutbreakAlertStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
}

/**
 * Records a triggered outbreak alert for a pathogen+location outbreak period.
 *
 * Dedup rule: at most one ACTIVE alert may exist for a given (pathogen,
 * location) pair at any time. While an alert is ACTIVE, the threshold
 * evaluation job will not create a new one for the same pathogen+location —
 * that active alert *is* the current outbreak period. A new alert can only
 * be raised again after the existing one is resolved.
 */
@Entity('outbreak_alerts')
@Index(['pathogen', 'location', 'status'])
export class OutbreakAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  thresholdId: string | null;

  @ManyToOne(() => OutbreakThreshold, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'thresholdId' })
  threshold: OutbreakThreshold | null;

  @Column()
  pathogen: string;

  @Column()
  location: string;

  @Column({ type: 'int' })
  thresholdCount: number;

  @Column({ type: 'int' })
  observedCount: number;

  @Column({ type: 'int' })
  windowMinutes: number;

  @Column({ type: 'timestamp' })
  windowStart: Date;

  @Column({ type: 'timestamp' })
  triggeredAt: Date;

  @Column({ type: 'enum', enum: OutbreakAlertStatus, default: OutbreakAlertStatus.ACTIVE })
  status: OutbreakAlertStatus;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ default: false })
  inAppNotified: boolean;

  @Column({ default: false })
  emailNotified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
