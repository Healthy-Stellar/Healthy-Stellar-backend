import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * DB-local "cold storage" for records purged by the data-retention
 * enforcement job. Each row is a verbatim snapshot of the source record,
 * written before the original row is deleted from its primary table.
 *
 * This is intentionally a minimal, DB-local archival mechanism — sufficient
 * to satisfy "archive before delete" without standing up an external
 * cold-storage/cloud-archive integration.
 */
@Entity('archived_records')
@Index(['entityType', 'tenantId'])
@Index(['entityType', 'originalId'])
export class ArchivedRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 64 })
  entityType: string;

  @Column({ name: 'original_id', type: 'varchar' })
  originalId: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'policy_id', type: 'varchar', length: 128 })
  policyId: string;

  /** Full snapshot of the source row at the time it was archived. */
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  /** Timestamp the source row was originally created, preserved for audit. */
  @Column({ name: 'original_created_at', type: 'timestamp with time zone' })
  originalCreatedAt: Date;

  @CreateDateColumn({ name: 'archived_at', type: 'timestamp with time zone' })
  archivedAt: Date;
}
