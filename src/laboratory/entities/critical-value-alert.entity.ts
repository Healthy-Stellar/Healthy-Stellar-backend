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
import { LabResultValue } from './lab-result-value.entity';

export enum AlertStatus {
  PENDING = 'pending',
  NOTIFIED = 'notified',
  ACKNOWLEDGED = 'acknowledged',
  ESCALATED = 'escalated',
}

export enum NotificationMethod {
  PHONE = 'phone',
  EMAIL = 'email',
  SMS = 'sms',
  SYSTEM = 'system',
  IN_PERSON = 'in_person',
}

@Entity('critical_value_alerts')
@Index(['resultValueId'])
@Index(['status'])
@Index(['notifiedTo'])
export class CriticalValueAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  resultValueId: string;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.PENDING,
  })
  status: AlertStatus;

  @Column({ type: 'uuid' })
  notifiedTo: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  notifiedToName: string;

  @Column({
    type: 'enum',
    enum: NotificationMethod,
    nullable: true,
  })
  notificationMethod: NotificationMethod;

  @Column({ type: 'timestamp', nullable: true })
  notificationDate: Date;

  @Column({ type: 'uuid', nullable: true })
  notifiedBy: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  notifiedByName: string;

  @Column({ type: 'uuid', nullable: true })
  acknowledgedBy: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  acknowledgedByName: string;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgmentDate: Date;

  @Column({ type: 'text', nullable: true })
  acknowledgmentNotes: string;

  @Column({ type: 'text', nullable: true })
  followUpActions: string;

  @Column({ type: 'int', default: 0 })
  notificationAttempts: number;

  @Column({ type: 'jsonb', nullable: true })
  notificationLog: Array<{
    timestamp: Date;
    method: NotificationMethod;
    status: string;
    notes?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => LabResultValue, (value) => value.criticalAlerts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'resultValueId' })
  resultValue: LabResultValue;
}
