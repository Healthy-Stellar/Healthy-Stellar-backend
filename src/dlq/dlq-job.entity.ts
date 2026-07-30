import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DlqJobStatus {
  FAILED = 'failed',
  REPLAYED = 'replayed',
  DISCARDED = 'discarded',
}

/**
 * Persistent record of every job that exhausted all BullMQ retries.
 * Allows replay, inspection, and audit outside of Redis (which is volatile).
 */
@Entity('dlq_jobs')
export class DlqJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** BullMQ job id */
  @Index()
  @Column({ type: 'varchar', length: 256 })
  jobId: string;

  /** Queue the job originally belonged to */
  @Index()
  @Column({ type: 'varchar', length: 128 })
  queueName: string;

  /** Job name / operation type */
  @Column({ type: 'varchar', length: 256 })
  jobName: string;

  /** Full job data payload */
  @Column({ type: 'jsonb' })
  data: Record<string, any>;

  /** BullMQ job options at time of failure */
  @Column({ type: 'jsonb', default: '{}' })
  opts: Record<string, any>;

  /** Last error message */
  @Column({ type: 'text', nullable: true })
  failedReason: string | null;

  /** Full stack trace of last failure */
  @Column({ type: 'text', nullable: true })
  stackTrace: string | null;

  /** Number of attempts made before landing in DLQ */
  @Column({ type: 'int', default: 0 })
  attemptsMade: number;

  @Index()
  @Column({
    type: 'enum',
    enum: DlqJobStatus,
    default: DlqJobStatus.FAILED,
  })
  status: DlqJobStatus;

  /** How many times this DLQ entry has been replayed */
  @Column({ type: 'int', default: 0 })
  replayCount: number;

  /** Who triggered the last replay */
  @Column({ type: 'varchar', length: 256, nullable: true })
  replayedBy: string | null;

  @CreateDateColumn()
  failedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
