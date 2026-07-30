import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RunbookExecution } from './runbook-execution.entity';

export enum RunbookStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived',
}

export enum RunbookCategory {
  DATABASE_RECOVERY = 'database_recovery',
  SERVICE_RESTART = 'service_restart',
  DATA_CORRECTION = 'data_correction',
  TENANT_RECOVERY = 'tenant_recovery',
  QUEUE_DRAIN = 'queue_drain',
  CACHE_FLUSH = 'cache_flush',
  SECURITY_INCIDENT = 'security_incident',
  GENERAL = 'general',
}

export interface RunbookStep {
  stepNumber: number;
  title: string;
  description: string;
  command?: string;
  expectedOutcome?: string;
  rollbackCommand?: string;
  requiresConfirmation: boolean;
  timeoutSeconds?: number;
}

@Entity('operator_runbooks')
@Index(['category', 'status'])
@Index(['createdBy', 'createdAt'])
export class Runbook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: RunbookCategory, default: RunbookCategory.GENERAL })
  category: RunbookCategory;

  @Column({ type: 'enum', enum: RunbookStatus, default: RunbookStatus.DRAFT })
  status: RunbookStatus;

  @Column({ type: 'jsonb' })
  steps: RunbookStep[];

  @Column({ type: 'varchar', length: 50, default: '1.0.0' })
  version: string;

  @Column({ type: 'uuid' })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @Column({ type: 'text', nullable: true })
  rollbackProcedure: string;

  @Column({ type: 'jsonb', nullable: true })
  requiredRoles: string[];

  @Column({ type: 'boolean', default: false })
  requiresDualApproval: boolean;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => RunbookExecution, (exec) => exec.runbook)
  executions: RunbookExecution[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
