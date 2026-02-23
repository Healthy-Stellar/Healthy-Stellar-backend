import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { MfaEntity } from './mfa.entity';
import { SessionEntity } from './session.entity';
import { AuditLogEntity } from '../../common/audit/audit-log.entity';

export enum UserRole {
  ADMIN = 'admin',
  PHYSICIAN = 'physician',
  NURSE = 'nurse',
  PATIENT = 'patient',
  BILLING_STAFF = 'billing_staff',
  MEDICAL_RECORDS = 'medical_records',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true, length: 200 })
  displayName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.PATIENT })
  role: UserRole;

  @Column({ default: false })
  isActive: boolean;

  @Column({ default: false })
  mfaEnabled: boolean;

  @Column({ nullable: true })
  mfaSecret: string;

  @Column({ nullable: true })
  lastPasswordChangeAt: Date;

  @Column({ default: 0 })
  failedLoginAttempts: number;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true })
  lockedUntil: Date;

  @Column({ default: false })
  requiresPasswordChange: boolean;

  @Column({ nullable: true, length: 255 })
  licenseNumber: string;

  @Column({ nullable: true, length: 255 })
  npi: string;

  @Column({ type: 'text', nullable: true })
  specialization: string;

  @Column({ default: true })
  emergencyAccessEnabled: boolean;
  @Column({ nullable: true, length: 255 })
  specialty: string;

  @Column({ nullable: true, length: 255 })
  institution: string;

  @Column({ nullable: true, length: 255, select: false })
  stellarPublicKey: string;

  @Column({ type: 'tsvector', nullable: true, select: false })
  search_vector: string;

  @Column({ type: 'simple-array', nullable: true })
  permissions: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  deletedAt: Date;

  @OneToMany(() => MfaEntity, (mfa) => mfa.user, { cascade: true })
  mfaDevices: MfaEntity[];

  @OneToMany(() => SessionEntity, (session) => session.user, { cascade: true })
  sessions: SessionEntity[];

  @OneToMany(() => AuditLogEntity, (log) => log.user)
  auditLogs: AuditLogEntity[];
}
