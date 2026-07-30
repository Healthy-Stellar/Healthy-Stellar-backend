import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** Append-only audit log populated by AuditProjector. */
@Entity('audit_logs_projection')
@Index(['aggregateId'])
@Index(['eventType'])
@Index(['occurredAt'])
export class AuditLogProjection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  aggregateId: string;

  @Column({ type: 'varchar', length: 100 })
  aggregateType: string;

  @Column({ type: 'varchar', length: 100 })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'integer' })
  version: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  occurredAt: Date;
}
