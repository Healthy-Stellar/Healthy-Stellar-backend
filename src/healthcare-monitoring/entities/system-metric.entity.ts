import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum MetricType {
  CPU_USAGE = 'cpu_usage',
  MEMORY_USAGE = 'memory_usage',
  DISK_USAGE = 'disk_usage',
  NETWORK_LATENCY = 'network_latency',
  DATABASE_CONNECTIONS = 'database_connections',
  API_RESPONSE_TIME = 'api_response_time',
  PATIENT_QUEUE_LENGTH = 'patient_queue_length',
  SYSTEM_UPTIME = 'system_uptime',
}

export enum MetricSeverity {
  NORMAL = 'normal',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

@Entity('system_metrics')
@Index(['metricType', 'timestamp'])
@Index(['severity', 'timestamp'])
export class SystemMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: MetricType,
  })
  metricType: MetricType;

  @Column('decimal', { precision: 10, scale: 2 })
  value: number;

  @Column({ length: 50 })
  unit: string;

  @Column({
    type: 'enum',
    enum: MetricSeverity,
    default: MetricSeverity.NORMAL,
  })
  severity: MetricSeverity;

  @Column({ length: 100 })
  source: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  timestamp: Date;
}