import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';
export type WorkflowType =
  | 'patient-admission'
  | 'patient-discharge'
  | 'lab-order'
  | 'medication-order'
  | 'surgical-prep'
  | 'emergency-triage'
  | 'bed-assignment'
  | 'shift-handover'
  | 'billing-process'
  | 'custom';

@Entity('workflow_executions')
@Index(['workflowType', 'status'])
@Index(['status', 'createdAt'])
@Index(['patientId'])
export class WorkflowExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  workflowType: WorkflowType;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: WorkflowStatus;

  @Column({ type: 'uuid', nullable: true })
  patientId: string;

  @Column({ type: 'int', default: 0 })
  currentStep: number;

  @Column({ type: 'int', default: 0 })
  totalSteps: number;

  @Column({ type: 'jsonb', nullable: true })
  stepResults: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'int', nullable: true })
  executionTimeMs: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  initiatedBy: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'int', default: 5 })
  priority: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;
}
