import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ImportJob } from './import-job.entity';

/**
 * Maximum number of characters of the raw source row that are persisted.
 * The raw HL7/CCD/CSV line is full PHI, so we only keep a truncated excerpt
 * for debugging purposes instead of the entire record.
 */
export const IMPORT_ERROR_SOURCE_ROW_MAX_LENGTH = 256;

@Entity('import_errors')
export class ImportError {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  jobId: string;

  @ManyToOne(() => ImportJob, (job) => job.errors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job: ImportJob;

  /**
   * Tenant that owns the parent import job. Denormalized so that every
   * controller query can be scoped by tenant without a join.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ type: 'int', nullable: true })
  rowNumber: number | null;

  /**
   * Truncated excerpt of the offending source row. Never store the full
   * raw PHI line here.
   */
  @Column({ type: 'text', nullable: true })
  sourceRow: string | null;

  @Column({ type: 'text' })
  message: string;

  /**
   * Stack traces are retained for internal diagnostics only and are never
   * returned by the API.
   */
  @Column({ type: 'text', nullable: true, select: false })
  stackTrace: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
