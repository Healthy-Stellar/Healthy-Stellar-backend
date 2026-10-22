import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

export enum ImportJobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ImportFormat {
  HL7 = 'hl7',
  CCD = 'ccd',
  CSV = 'csv',
}

@Entity('import_jobs')
@Index(['importBatchId'], { unique: true })
export class ImportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  importBatchId: string;

  @Column({ type: 'enum', enum: ImportFormat })
  format: ImportFormat;

  @Column({ type: 'enum', enum: ImportJobStatus, default: ImportJobStatus.QUEUED })
  status: ImportJobStatus;

  @Column({ type: 'int', default: 0 })
  total: number;

  @Column({ type: 'int', default: 0 })
  processed: number;

  @Column({ type: 'int', default: 0 })
  succeeded: number;

  @Column({ type: 'int', default: 0 })
  failed: number;

  @Column({ type: 'int', default: 0 })
  skippedDuplicate: number;

  @Column({ type: 'int', default: 0 })
  quarantined: number;

  @Column({ type: 'boolean', default: false })
  dryRun: boolean;

  @Column({ type: 'boolean', default: false })
  quarantineMode: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
