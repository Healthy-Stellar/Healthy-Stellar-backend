import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum SensitiveAuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  RECORD_ACCESS = 'RECORD_ACCESS',
  RECORD_CREATE = 'RECORD_CREATE',
  RECORD_UPDATE = 'RECORD_UPDATE',
  GRANT_CHANGE = 'GRANT_CHANGE',
  GRANT_REVOKE = 'GRANT_REVOKE',
  ADMIN_OPERATION = 'ADMIN_OPERATION',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  MFA_CHANGE = 'MFA_CHANGE',
  USER_CREATED = 'USER_CREATED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
}

/**
 * Tamper-evident audit log for sensitive actions.
 * Rows are INSERT-only — enforced by DB trigger (see migration 1772500000000).
 */
@Entity('audit_log')
@Index('idx_audit_log_actor', ['actorAddress'])
@Index('idx_audit_log_timestamp', ['timestamp'])
@Index('idx_audit_log_actor_timestamp', ['actorAddress', 'timestamp'])
export class SensitiveAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Wallet address or user ID of the actor performing the action */
  @Column({ type: 'varchar', length: 255 })
  actorAddress: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  /** Wallet address or user ID of the target (optional) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  targetAddress: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resourceType: string | null;

  @Column({ type: 'uuid', nullable: true })
  resourceId: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  metadata: Record<string, any>;
}
