import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('projection_checkpoints')
export class ProjectionCheckpoint extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'projector_name' })
  projectorName: string;

  @Column({ name: 'last_processed_version', type: 'bigint', default: 0 })
  lastProcessedVersion: number;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt: Date;

  @Column({ name: 'event_count', type: 'bigint', default: 0 })
  eventCount: number;
}
