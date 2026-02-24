import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LabWorkflow } from './lab-workflow.entity';

export enum StepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

export enum StepType {
  SAMPLE_COLLECTION = 'sample_collection',
  SAMPLE_PREPARATION = 'sample_preparation',
  ANALYSIS = 'analysis',
  QUALITY_CHECK = 'quality_check',
  RESULT_REVIEW = 'result_review',
  RESULT_APPROVAL = 'result_approval',
  REPORT_GENERATION = 'report_generation',
}

@Entity('lab_workflow_steps')
export class LabWorkflowStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workflow_id' })
  workflowId: string;

  @ManyToOne(() => LabWorkflow, (workflow) => workflow.steps)
  @JoinColumn({ name: 'workflow_id' })
  workflow: LabWorkflow;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: StepType })
  type: StepType;

  @Column({ type: 'enum', enum: StepStatus, default: StepStatus.PENDING })
  status: StepStatus;

  @Column({ name: 'step_order' })
  stepOrder: number;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo: string;

  @Column({ name: 'equipment_id', nullable: true })
  equipmentId: string;

  @Column({ name: 'estimated_duration', nullable: true })
  estimatedDuration: number; // in minutes

  @Column({ name: 'actual_duration', nullable: true })
  actualDuration: number; // in minutes

  @Column({ type: 'json', nullable: true })
  parameters: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  results: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
