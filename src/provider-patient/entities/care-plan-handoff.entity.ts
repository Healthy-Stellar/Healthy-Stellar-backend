import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum HandoffStatus {
  PENDING = 'pending',
  ACKNOWLEDGED = 'acknowledged',
  ESCALATED = 'escalated',
}

@Entity('care_plan_handoffs')
@Index(['patientId', 'handoffTime'])
@Index(['toProvider', 'status'])
export class CarePlanHandoff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  fromProvider: string;

  @Column({ type: 'uuid' })
  @Index()
  toProvider: string;

  @Column({ type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'jsonb', default: [] })
  pendingTasks: string[];

  @Column({ type: 'timestamp' })
  handoffTime: Date;

  @Column({
    type: 'enum',
    enum: HandoffStatus,
    default: HandoffStatus.PENDING,
  })
  status: HandoffStatus;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  acknowledgedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  escalatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  escalatedTo: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
