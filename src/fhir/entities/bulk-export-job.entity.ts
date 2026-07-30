import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ExportJobStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ExportScope {
  SYSTEM = 'system',
  GROUP  = 'group',
  PATIENT = 'patient',
}

@Entity('bulk_export_jobs')
export class BulkExportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  requesterId: string;

  @Column()
  requesterRole: string;

  @Column({ type: 'simple-array', nullable: true })
  resourceTypes: string[];

  @Column({ type: 'enum', enum: ExportJobStatus, default: ExportJobStatus.PENDING })
  status: ExportJobStatus;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ type: 'int', default: 0 })
  totalResources: number;

  @Column({ type: 'simple-json', nullable: true })
  outputFiles: Array<{ type: string; url: string; count: number }>;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  /** ISO 8601 instant — only resources updated after this date are exported. */
  @Column({ type: 'timestamp', nullable: true })
  since: Date | null;

  /** Requested NDJSON output format (defaults to application/fhir+ndjson). */
  @Column({ type: 'varchar', nullable: true, default: 'application/fhir+ndjson' })
  outputFormat: string;

  /** Export scope: system-level, group-level, or patient-level. */
  @Column({
    type: 'enum',
    enum: ExportScope,
    default: ExportScope.PATIENT,
  })
  exportScope: ExportScope;

  /** For group-level exports, the FHIR Group resource ID. */
  @Column({ type: 'varchar', nullable: true })
  groupId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
