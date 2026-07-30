import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** Materialised aggregate state at a given version to avoid full replay. */
@Entity('event_store_snapshots')
@Index(['aggregateId', 'version'])
export class AggregateSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'aggregate_id' })
  @Index()
  aggregateId: string;

  @Column({ type: 'varchar', length: 100, name: 'aggregate_type' })
  aggregateType: string;

  /** Version of the last event included in this snapshot. */
  @Column({ type: 'integer' })
  version: number;

  @Column({ type: 'jsonb' })
  state: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'created_at' })
  createdAt: Date;
}

export interface AggregateSnapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: Record<string, unknown>;
}
