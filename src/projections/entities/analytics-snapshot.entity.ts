import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';

/** Analytics snapshot materialized view updated by AnalyticsProjector. */
@Entity('analytics_snapshots')
@Index(['snapshotDate'])
export class AnalyticsSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', unique: true })
  snapshotDate: string;

  @Column({ type: 'integer', default: 0 })
  totalRecordsUploaded: number;

  @Column({ type: 'integer', default: 0 })
  totalAccessGranted: number;

  @Column({ type: 'integer', default: 0 })
  totalAccessRevoked: number;

  @Column({ type: 'integer', default: 0 })
  totalRecordsAmended: number;

  @Column({ type: 'integer', default: 0 })
  totalEmergencyAccess: number;

  @Column({ type: 'integer', default: 0 })
  totalRecordsDeleted: number;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}
