import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * A single PHI access event.
 *
 * HIPAA expects this trail to outlive the process that wrote it, so these rows
 * are append-only: the service exposes no update or delete path, and nothing
 * here cascades from another table.
 */
@Entity('hipaa_audit_logs')
@Index(['resourceType', 'resourceId', 'timestamp'])
@Index(['userId', 'timestamp'])
export class HipaaAuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  resourceType: string;

  @Column({ type: 'varchar', length: 255 })
  resourceId: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 255 })
  userId: string;

  /**
   * When the access happened, which is not always when the row was written —
   * `createdAt` records the latter and the two can differ under retry.
   */
  @Column({ type: 'timestamp' })
  @Index()
  timestamp: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
