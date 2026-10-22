import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('projection_checkpoints')
@Index(['projectorName', 'aggregateId'], { unique: true })
export class ProjectionCheckpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'projector_name' })
  projectorName: string;

  /**
   * Event-store versions are scoped per-aggregate, so the checkpoint must be
   * tracked per (projector, aggregate) pair rather than as a single global
   * counter — otherwise progress on one aggregate incorrectly gates events
   * from every other aggregate.
   */
  @Column({ name: 'aggregate_id' })
  aggregateId: string;

  @Column({ name: 'last_processed_version', type: 'bigint', default: 0 })
  lastProcessedVersion: number;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'event_count', type: 'bigint', default: 0 })
  eventCount: number;
}
