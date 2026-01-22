import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  VersionColumn,
} from 'typeorm';
import { MedicalRecordVersion } from './medical-record-version.entity';
import { MedicalHistory } from './medical-history.entity';
import { MedicalAttachment } from './medical-attachment.entity';
import { MedicalRecordConsent } from './medical-record-consent.entity';

export enum MedicalRecordStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

export enum RecordType {
  CONSULTATION = 'consultation',
  DIAGNOSIS = 'diagnosis',
  TREATMENT = 'treatment',
  LAB_RESULT = 'lab_result',
  IMAGING = 'imaging',
  PRESCRIPTION = 'prescription',
  SURGERY = 'surgery',
  EMERGENCY = 'emergency',
  OTHER = 'other',
}

@Entity('medical_records')
@Index(['patientId', 'createdAt'])
@Index(['status', 'recordType'])
export class MedicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ type: 'uuid', nullable: true })
  providerId: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({
    type: 'enum',
    enum: RecordType,
    default: RecordType.OTHER,
  })
  recordType: RecordType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: MedicalRecordStatus,
    default: MedicalRecordStatus.ACTIVE,
  })
  status: MedicalRecordStatus;

  @Column({ type: 'timestamp', nullable: true })
  recordDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  // Relations
  @OneToMany(() => MedicalRecordVersion, (version) => version.medicalRecord, {
    cascade: true,
  })
  versions: MedicalRecordVersion[];

  @OneToMany(() => MedicalHistory, (history) => history.medicalRecord, {
    cascade: true,
  })
  history: MedicalHistory[];

  @OneToMany(() => MedicalAttachment, (attachment) => attachment.medicalRecord, {
    cascade: true,
  })
  attachments: MedicalAttachment[];

  @OneToMany(() => MedicalRecordConsent, (consent) => consent.medicalRecord, {
    cascade: true,
  })
  consents: MedicalRecordConsent[];
}
