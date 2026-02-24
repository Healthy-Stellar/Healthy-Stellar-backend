import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('analytics_snapshots')
@Index(['category', 'snapshotDate'])
@Index(['snapshotDate'])
export class AnalyticsSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'varchar', length: 255 })
  metricName: string;

  @Column({ type: 'jsonb' })
  data: Record<string, any>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string;

  @Column({ type: 'varchar', length: 50, default: 'daily' })
  granularity: string;

  @Column({ type: 'int', nullable: true })
  computeTimeMs: number;

  @CreateDateColumn()
  snapshotDate: Date;
}
