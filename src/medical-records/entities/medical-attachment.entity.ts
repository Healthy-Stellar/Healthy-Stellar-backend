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

export enum AttachmentType {
  IMAGE = 'image',
  DOCUMENT = 'document',
  LAB_REPORT = 'lab_report',
  XRAY = 'xray',
  SCAN = 'scan',
  PRESCRIPTION = 'prescription',
  OTHER = 'other',
}

@Entity('medical_attachments')
@Index(['medicalRecordId', 'createdAt'])
export class MedicalAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  medicalRecordId: string;

  @ManyToOne(() => MedicalRecord, (record) => record.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'medicalRecordId' })
  medicalRecord: MedicalRecord;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 255 })
  originalFileName: string;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'bigint' })
  fileSize: number;

  @Column({ type: 'varchar', length: 500 })
  filePath: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  fileUrl: string;

  @Column({
    type: 'enum',
    enum: AttachmentType,
    default: AttachmentType.OTHER,
  })
  attachmentType: AttachmentType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'uuid' })
  uploadedBy: string;

  /** SHA-256 hex digest of the file content — used for integrity verification */
  @Column({ type: 'varchar', length: 64, nullable: true })
  checksum: string;

  /** IP address of the uploader for anti-abuse auditing */
  @Column({ type: 'varchar', length: 45, nullable: true })
  uploadedByIp: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // ── OCR fields ────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 20, nullable: true })
  ocrStatus: 'pending' | 'completed' | 'failed' | null;

  @Column({ type: 'text', nullable: true })
  extractedText: string;

  /** Confidence score 0–1 from the OCR provider; < 0.7 flags for manual review */
  @Column({ type: 'float', nullable: true })
  ocrConfidence: number;

  @Column({ type: 'boolean', default: false })
  flaggedForReview: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
