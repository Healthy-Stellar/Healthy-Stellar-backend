import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Runbook } from './runbook.entity';

export enum ExecutionStatus {
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
  CANCELLED = 'cancelled',
}

export interface StepExecutionResult {
  stepNumber: number;
  status: 'success' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  executedBy: string;
}

@Entity('runbook_executions')
@Index(['runbookId', 'createdAt'])
@Index(['status', 'createdAt'])
@Index(['executedBy', 'createdAt'])
export class RunbookExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  runbookId: string;

  @ManyToOne(() => Runbook, (runbook) => runbook.executions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'runbookId' })
  runbook: Runbook;

  @Column({ type: 'enum', enum: ExecutionStatus, default: ExecutionStatus.PENDING_APPROVAL })
  status: ExecutionStatus;

  @Column({ type: 'uuid' })
  initiatedBy: string;

  @Column({ type: 'uuid', nullable: true })
  executedBy: string;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ type: 'uuid', nullable: true })
  secondApprovalBy: string;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  stepResults: StepExecutionResult[];

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'boolean', default: false })
  dryRun: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
