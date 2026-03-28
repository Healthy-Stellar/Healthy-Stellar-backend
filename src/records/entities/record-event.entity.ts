import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * Immutable event log for the records aggregate.
 * Every state change is stored as an append-only event.
 * Current state is derived by replaying events in sequence order.
 */
export enum RecordEventType {
  RECORD_CREATED = 'RECORD_CREATED',
  RECORD_UPDATED = 'RECORD_UPDATED',
  RECORD_DESCRIPTION_CHANGED = 'RECORD_DESCRIPTION_CHANGED',
  RECORD_TYPE_CHANGED = 'RECORD_TYPE_CHANGED',
  RECORD_STELLAR_ANCHORED = 'RECORD_STELLAR_ANCHORED',
  RECORD_DELETED = 'RECORD_DELETED',
  RECORD_MIGRATED = 'RECORD_MIGRATED',
  RECORD_AMENDED = 'RECORD_AMENDED',
}

@Entity('record_events')
@Index(['recordId', 'sequenceNumber'])
@Index(['recordId', 'timestamp'])
@Unique('UQ_record_events_record_seq', ['recordId', 'sequenceNumber'])
export class RecordEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'record_id' })
  @Index()
  recordId: string;

  @Column({ type: 'varchar', length: 100, name: 'event_type' })
  eventType: RecordEventType;

  /**
   * Full event payload as JSONB — contains all fields relevant to the event.
   * For RECORD_CREATED: { patientId, recordType, description, cid, stellarTxHash }
   * For RECORD_UPDATED: { changes: { field: { old, new } } }
   */
  @Column({ type: 'jsonb', name: 'payload' })
  payload: Record<string, any>;

  /**
   * Monotonically increasing per-record sequence number.
   * Used for ordering and optimistic concurrency control.
   */
  @Column({ type: 'integer', name: 'sequence_number' })
  sequenceNumber: number;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'timestamp' })
  timestamp: Date;

  /** Optional: ID of the user who caused this event */
  @Column({ type: 'uuid', name: 'caused_by', nullable: true })
  causedBy: string | null;
}
