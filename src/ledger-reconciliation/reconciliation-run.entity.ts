import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum ReconciliationRunStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('reconciliation_runs')
@Index(['startedAt'])
export class ReconciliationRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ReconciliationRunStatus, default: ReconciliationRunStatus.RUNNING })
  status: ReconciliationRunStatus;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamp with time zone', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  recordsChecked: number;

  @Column({ type: 'int', default: 0 })
  confirmed: number;

  @Column({ type: 'int', default: 0 })
  failed: number;

  @Column({ type: 'int', default: 0 })
  missing: number;

  @Column({ type: 'int', default: 0 })
  errors: number;
}
