import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CriticalAlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

@Entity('critical_care_monitoring')
@Index(['patientId', 'recordedAt'])
export class CriticalCareMonitoring {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patientId: string;

  @Column({ type: 'varchar', length: 100 })
  metricType: string;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  value: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  unit: string;

  @Column({ type: 'timestamp' })
  recordedAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source: string;

  @Column({ type: 'boolean', default: false })
  thresholdBreach: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('critical_care_alerts')
@Index(['patientId', 'createdAt'])
export class CriticalCareAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patientId: string;

  @Column({ type: 'varchar', length: 100 })
  alertType: string;

  @Column({ type: 'enum', enum: CriticalAlertSeverity, default: CriticalAlertSeverity.WARNING })
  severity: CriticalAlertSeverity;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'boolean', default: false })
  acknowledged: boolean;

  @Column({ type: 'uuid', nullable: true })
  acknowledgedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
