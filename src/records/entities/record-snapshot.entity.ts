import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Materialised snapshot of a record's state at a given sequence number.
 * Rebuilt every SNAPSHOT_INTERVAL events to avoid full replay from event 0.
 */
@Entity('record_snapshots')
@Index(['recordId', 'sequenceNumber'])
export class RecordSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'record_id' })
  @Index()
  recordId: string;

  /**
   * The sequence number of the last event included in this snapshot.
   * Replay only needs events with sequenceNumber > this value.
   */
  @Column({ type: 'integer', name: 'sequence_number' })
  sequenceNumber: number;

  /**
   * Full denormalised record state at the snapshot point.
   */
  @Column({ type: 'jsonb', name: 'state' })
  state: Record<string, any>;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;
}
