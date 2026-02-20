import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  USER_CREATED = 'USER_CREATED',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_VERIFIED = 'MFA_VERIFIED',
  MFA_DISABLED = 'MFA_DISABLED',
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_EXPORT = 'DATA_EXPORT',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
}

@Entity('audit_logs')
@Index(['action', 'timestamp'])
@Index(['severity', 'timestamp'])
@Index(['entity', 'entityId'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @Column()
  action: string;

  @Column()
  entity: string;

  @Column({ nullable: true })
  entityId: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column('json', { nullable: true })
  details: Record<string, any>;

  @Column()
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ default: false })
  reviewed: boolean;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  resourceId: string;

  @Column({ nullable: true })
  resourceType: string;

  @Column({ default: false })
  requiresInvestigation: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.auditLogs, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
