import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * Immutable event store row.
 * UPDATE and DELETE are blocked by a PostgreSQL trigger (see migration).
 */
@Entity('event_store')
@Index(['aggregateId', 'version'])
@Unique('UQ_event_store_aggregate_version', ['aggregateId', 'version'])
export class EventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'aggregate_id' })
  @Index()
  aggregateId: string;

  @Column({ type: 'varchar', length: 100, name: 'aggregate_type' })
  aggregateType: string;

  @Column({ type: 'varchar', length: 100, name: 'event_type' })
  eventType: string;

  /** Full event payload — all fields specific to the event type. */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  /** Caller-supplied context: userId, correlationId, IP, etc. */
  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  /**
   * Monotonically increasing per-aggregate version number.
   * Used for optimistic concurrency control.
   */
  @Column({ type: 'integer' })
  version: number;

  /** Business time: when the event logically occurred. */
  @CreateDateColumn({ type: 'timestamp with time zone', name: 'occurred_at' })
  occurredAt: Date;

  /** Wall-clock time: when the row was inserted into the store. */
  @CreateDateColumn({ type: 'timestamp with time zone', name: 'recorded_at' })
  recordedAt: Date;
}
