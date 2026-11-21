import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ExportBatchStatus {
  ACTIVE = 'active',
  FLAGGED = 'flagged',
  PURGED = 'purged',
}

@Entity('export_consent_mappings')
export class ExportConsentMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  exportId: string;

  @Index()
  @Column({ type: 'uuid' })
  patientId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  consentId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  tenantId: string;

  @Column({ type: 'varchar', nullable: true })
  researchRecipientId: string | null;

  @Column({
    type: 'enum',
    enum: ExportBatchStatus,
    default: ExportBatchStatus.ACTIVE,
  })
  status: ExportBatchStatus;

  @Column({ type: 'timestamp', nullable: true })
  flaggedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  flagReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
