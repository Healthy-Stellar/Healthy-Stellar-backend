import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { LabOrder } from './lab-order.entity';
import { LabWorkflowStep } from './lab-workflow-step.entity';

export enum WorkflowStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

export enum WorkflowPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
  STAT = 'stat',
}

@Entity('lab_workflows')
export class LabWorkflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: WorkflowStatus, default: WorkflowStatus.PENDING })
  status: WorkflowStatus;

  @Column({ type: 'enum', enum: WorkflowPriority, default: WorkflowPriority.NORMAL })
  priority: WorkflowPriority;

  @Column({ name: 'lab_order_id' })
  labOrderId: string;

  @ManyToOne(() => LabOrder)
  @JoinColumn({ name: 'lab_order_id' })
  labOrder: LabOrder;

  @OneToMany(() => LabWorkflowStep, (step) => step.workflow, { cascade: true })
  steps: LabWorkflowStep[];

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo: string;

  @Column({ name: 'estimated_duration', nullable: true })
  estimatedDuration: number; // in minutes

  @Column({ name: 'actual_duration', nullable: true })
  actualDuration: number; // in minutes

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
