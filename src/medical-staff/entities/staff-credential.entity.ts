import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CredentialStatus {
  ACTIVE = 'active',
  EXPIRING_SOON = 'expiring_soon',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export enum CredentialType {
  MEDICAL_LICENSE = 'medical_license',
  BOARD_CERTIFICATION = 'board_certification',
  DEA_REGISTRATION = 'dea_registration',
  NPI = 'npi',
  BLS = 'bls',
  ACLS = 'acls',
  SPECIALTY_CERTIFICATION = 'specialty_certification',
  OTHER = 'other',
}

@Entity('staff_credentials')
@Index(['staffId', 'status'])
export class StaffCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  staffId: string;

  @Column({ type: 'enum', enum: CredentialType })
  type: CredentialType;

  @Column()
  credentialNumber: string;

  @Column()
  issuingBody: string;

  @Column({ nullable: true })
  issuingState: string;

  @Column({ type: 'date' })
  issuedAt: Date;

  @Column({ type: 'date' })
  expiresAt: Date;

  @Column({
    type: 'enum',
    enum: CredentialStatus,
    default: CredentialStatus.ACTIVE,
  })
  status: CredentialStatus;

  @Column({ default: false })
  reminderSent: boolean;

  @Column('timestamp', { nullable: true })
  lastReminderSentAt: Date;

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
