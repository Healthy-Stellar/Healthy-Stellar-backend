import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum AuditAction {
  // PHI Access
  PHI_ACCESS = 'PHI_ACCESS',
  PHI_CREATE = 'PHI_CREATE',
  PHI_UPDATE = 'PHI_UPDATE',
  PHI_DELETE = 'PHI_DELETE',
  PHI_EXPORT = 'PHI_EXPORT',
  PHI_PRINT = 'PHI_PRINT',
  // Authentication
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  MFA_SUCCESS = 'MFA_SUCCESS',
  MFA_FAILURE = 'MFA_FAILURE',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  // Access Control
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REVOKED = 'ROLE_REVOKED',
  // Security Events
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  ENCRYPTION_OPERATION = 'ENCRYPTION_OPERATION',
  // Device Events
  DEVICE_AUTHENTICATED = 'DEVICE_AUTHENTICATED',
  DEVICE_REJECTED = 'DEVICE_REJECTED',
  DEVICE_REGISTERED = 'DEVICE_REGISTERED',
  DEVICE_REVOKED = 'DEVICE_REVOKED',
  // Administrative
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  POLICY_UPDATED = 'POLICY_UPDATED',
  BREACH_REPORTED = 'BREACH_REPORTED',
  INCIDENT_CREATED = 'INCIDENT_CREATED',
}

export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  EMERGENCY = 'EMERGENCY',
}

@Entity('audit_logs')
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['patientIdHash', 'createdAt'])
@Index(['severity', 'createdAt'])
@Index(['ipAddress', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index()
  userId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  userRoleSnapshot: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  patientIdHash: string | null;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'enum', enum: AuditSeverity, default: AuditSeverity.INFO })
  severity: AuditSeverity;

  @Column({ type: 'varchar', length: 255 })
  resource: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  resourceId: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  requestPath: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  requestMethod: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  isAnomaly: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  deviceId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  correlationId: string | null;

  @Column({ type: 'varchar', length: 128 })
  integrityHash: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
