import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MetricType {
  TURNAROUND_TIME = 'turnaround_time',
  THROUGHPUT = 'throughput',
  ERROR_RATE = 'error_rate',
  EQUIPMENT_UTILIZATION = 'equipment_utilization',
  STAFF_PRODUCTIVITY = 'staff_productivity',
  QUALITY_METRICS = 'quality_metrics',
  COST_PER_TEST = 'cost_per_test',
}

export enum MetricPeriod {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

@Entity('lab_analytics')
export class LabAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: MetricType })
  metricType: MetricType;

  @Column({ type: 'enum', enum: MetricPeriod })
  period: MetricPeriod;

  @Column({ name: 'period_start' })
  periodStart: Date;

  @Column({ name: 'period_end' })
  periodEnd: Date;

  @Column({ name: 'metric_value', type: 'decimal', precision: 10, scale: 4 })
  metricValue: number;

  @Column({ nullable: true })
  unit: string;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  @Column({ name: 'equipment_id', nullable: true })
  equipmentId: string;

  @Column({ name: 'test_type', nullable: true })
  testType: string;

  @Column({ name: 'staff_id', nullable: true })
  staffId: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'target_value', type: 'decimal', precision: 10, scale: 4, nullable: true })
  targetValue: number;

  @Column({ name: 'benchmark_value', type: 'decimal', precision: 10, scale: 4, nullable: true })
  benchmarkValue: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
