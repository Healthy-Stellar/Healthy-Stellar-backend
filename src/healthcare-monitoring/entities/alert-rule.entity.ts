import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { AlertPriority } from './clinical-alert.entity';

export enum AlertOperator {
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',
  EQ = 'eq',
}

export const VALID_METRIC_NAMES = [
  'heartRate',
  'systolicBp',
  'diastolicBp',
  'oxygenSaturation',
  'temperature',
  'respiratoryRate',
  'bloodGlucose',
] as const;

export type MetricName = (typeof VALID_METRIC_NAMES)[number];

@Entity('alert_rules')
@Index(['patientId', 'isActive'])
@Index(['tenantId', 'isActive'])
export class AlertRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  patientId: string;

  @Column({ type: 'uuid', nullable: true })
  tenantId: string;

  /** Vital metric field name, e.g. 'heartRate' */
  @Column({ length: 50 })
  metricName: string;

  @Column({
    type: 'enum',
    enum: AlertOperator,
  })
  operator: AlertOperator;

  /** Value the metric is compared against */
  @Column({ type: 'decimal', precision: 10, scale: 4 })
  threshold: number;

  @Column({
    type: 'enum',
    enum: AlertPriority,
    default: AlertPriority.HIGH,
  })
  priority: AlertPriority;

  @Column({ default: true })
  isActive: boolean;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column('uuid')
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
