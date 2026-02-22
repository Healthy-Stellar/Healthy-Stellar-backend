import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TriageQueueStatus {
  WAITING = 'waiting',
  IN_CARE = 'in_care',
  ADMITTED = 'admitted',
  DISCHARGED = 'discharged',
  TRANSFERRED = 'transferred',
}

@Entity('emergency_triage_cases')
@Index(['patientId', 'createdAt'])
@Index(['acuityLevel', 'queueStatus'])
export class EmergencyTriageCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  patientId: string;

  @Column({ type: 'varchar', length: 255 })
  chiefComplaint: string;

  // ESI-like priority: 1 highest acuity, 5 lowest.
  @Column({ type: 'int' })
  acuityLevel: number;

  @Column({
    type: 'enum',
    enum: TriageQueueStatus,
    default: TriageQueueStatus.WAITING,
  })
  queueStatus: TriageQueueStatus;

  @Column({ type: 'uuid', nullable: true })
  triagedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  triagedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
