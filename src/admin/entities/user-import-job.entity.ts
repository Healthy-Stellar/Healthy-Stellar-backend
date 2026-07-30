import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ImportJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('user_import_jobs')
export class UserImportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ImportJobStatus, default: ImportJobStatus.PENDING })
  status: ImportJobStatus;

  @Column()
  totalRows: number;

  @Column({ default: 0 })
  processedRows: number;

  @Column({ default: 0 })
  successRows: number;

  @Column({ default: 0 })
  failedRows: number;

  @Column({ nullable: true, type: 'uuid' })
  initiatedBy: string;

  @Column({ type: 'jsonb', nullable: true })
  rowErrors: Array<{ row: number; errors: string[] }>;

  @Column({ nullable: true, type: 'text' })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
