import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('projection_checkpoints')
export class ProjectionCheckpoint {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  projectorName: string;

  @Column({ type: 'bigint', default: 0 })
  lastProcessedVersion: number;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
