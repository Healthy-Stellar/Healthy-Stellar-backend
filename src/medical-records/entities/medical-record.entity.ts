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
import { PhiGcmTransformer } from '../../common/transformers/phi-gcm.transformer';
import { PhiDeterministicTransformer } from '../../common/transformers/phi-deterministic.transformer';

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

// Singleton transformer instances (constructed once, key read once at startup)
const gcmTransformer = new PhiGcmTransformer();
const deterministicTransformer = new PhiDeterministicTransformer();

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
  @Index()
  organizationId: string;

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

  /**
   * PHI: free-text title — encrypted with randomised AES-256-GCM.
   * Column type changed to text to hold base64 ciphertext.
   */
  @Column({ type: 'text', nullable: true, transformer: gcmTransformer })
  title: string;

  /**
   * PHI: free-text clinical description / notes — randomised AES-256-GCM.
   */
  @Column({ type: 'text', nullable: true, transformer: gcmTransformer })
  description: string;

  /**
   * PHI: diagnosis codes (ICD-10 etc.) stored as comma-separated string.
   * Deterministic encryption preserves equality-search capability.
   */
  @Column({ type: 'text', nullable: true, transformer: deterministicTransformer })
  diagnosis: string;

  /**
   * PHI: searchable tags (e.g. "hypertension,diabetes").
   * Deterministic encryption preserves equality-search capability.
   */
  @Column({ type: 'text', nullable: true, transformer: deterministicTransformer })
  tags: string;

  /**
   * PHI: free-text clinical notes — randomised AES-256-GCM.
   */
  @Column({ type: 'text', nullable: true, transformer: gcmTransformer })
  notes: string;

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

  @Column({ type: 'varchar', length: 255, nullable: true })
  stellarTxHash: string;

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
