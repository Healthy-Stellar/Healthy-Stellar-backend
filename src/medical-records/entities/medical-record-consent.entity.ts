import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MedicalRecord } from './medical-record.entity';

export enum ConsentStatus {
  PENDING = 'pending',
  GRANTED = 'granted',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export enum ConsentType {
  VIEW = 'view',
  SHARE = 'share',
  DOWNLOAD = 'download',
  MODIFY = 'modify',
  DELETE = 'delete',
}

@Entity('medical_record_consents')
@Index(['medicalRecordId', 'status'])
@Index(['patientId', 'status'])
export class MedicalRecordConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  medicalRecordId: string;

  @ManyToOne(() => MedicalRecord, (record) => record.consents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'medicalRecordId' })
  medicalRecord: MedicalRecord;

  @Column({ type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ type: 'uuid', nullable: true })
  sharedWithUserId: string;

  @Column({ type: 'uuid', nullable: true })
  sharedWithOrganizationId: string;

  @Column({
    type: 'enum',
    enum: ConsentType,
  })
  consentType: ConsentType;

  @Column({
    type: 'enum',
    enum: ConsentStatus,
    default: ConsentStatus.PENDING,
  })
  status: ConsentStatus;

  @Column({ type: 'text', nullable: true })
  purpose: string;

  @Column({ type: 'text', nullable: true })
  conditions: string;

  @Column({ type: 'timestamp', nullable: true })
  grantedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  grantedBy: string;

  @Column({ type: 'uuid', nullable: true })
  revokedBy: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  revocationReason: string;

  @Column({ type: 'jsonb', nullable: true })
  consentData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
