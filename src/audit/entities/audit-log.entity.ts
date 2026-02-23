import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuditAction, ResourceType } from '../dto/audit-event.dto';

@Entity('audit_logs')
@Index(['actorId', 'createdAt'])
@Index(['resourceId', 'createdAt'])
@Index(['resourceType', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['patientId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  actorId: string;

  @Column({ type: 'varchar', length: 50 })
  action: AuditAction;

  @Column({ type: 'varchar', length: 255 })
  resourceId: string;

  @Column({ type: 'varchar', length: 50 })
  resourceType: ResourceType;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  patientId: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stellarTxHash: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'varchar', length: 128 })
  integrityHash: string;

  @CreateDateColumn({ type: 'timestamptz' })
  @Index()
  createdAt: Date;

  // Computed field for display
  get timestamp(): Date {
    return this.createdAt;
  }
}
