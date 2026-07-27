import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OutboxStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Persistent outbox entry for notification delivery.
 *
 * Implements the transactional outbox pattern: every notification side-effect
 * is written to this table before delivery is attempted. A scheduled processor
 * sweeps PENDING/FAILED entries and retries them with exponential back-off,
 * guaranteeing at-least-once delivery even across process restarts.
 */
@Entity('notification_outbox')
export class NotificationOutboxEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Stable, caller-supplied key that prevents duplicate deliveries.
   * Unique constraint ensures idempotency at the DB level.
   */
  @Column({ unique: true })
  @Index()
  dedupe_key: string;

  /** Serialised {@link NotificationEvent} payload. */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  /** Target patient/user ID for delivery routing. */
  @Column()
  @Index()
  patient_id: string;

  @Column({ type: 'enum', enum: OutboxStatus, default: OutboxStatus.PENDING })
  @Index()
  status: OutboxStatus;

  /** How many delivery attempts have been made so far. */
  @Column({ type: 'int', default: 0 })
  attempts: number;

  /** Maximum number of attempts before the entry is marked FAILED permanently. */
  @Column({ type: 'int', default: 5 })
  max_attempts: number;

  /** Earliest time at which the next attempt may be made (null = immediately). */
  @Column({ type: 'timestamptz', nullable: true })
  @Index()
  next_attempt_at: Date | null;

  /** Human-readable description of the last error, for observability. */
  @Column({ type: 'text', nullable: true })
  last_error: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
