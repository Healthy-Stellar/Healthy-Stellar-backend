import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ComplianceReportType {
  HIPAA = 'HIPAA',
  GDPR = 'GDPR',
  SOC2 = 'SOC2',
}

export enum ComplianceReportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('compliance_report_jobs')
@Index(['reportType', 'status'])
export class ComplianceReportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  reportType: ComplianceReportType;

  /**
   * Postgres `date` columns are hydrated by TypeORM as 'YYYY-MM-DD' strings,
   * not Date objects, so readers must convert explicitly (see
   * ComplianceReportsService.toDay()).
   */
  @Column({ type: 'date' })
  startDate: Date | string;

  @Column({ type: 'date' })
  endDate: Date | string;

  @Column({ type: 'varchar', default: ComplianceReportStatus.PENDING })
  @Index()
  status: ComplianceReportStatus;

  @Column({ type: 'uuid', nullable: true })
  requestedByUserId: string;

  /** Owning tenant. Null marks a platform-wide report, which only SUPER_ADMIN may read. */
  @Column({ type: 'uuid', nullable: true })
  @Index('IDX_compliance_report_jobs_tenantId')
  tenantId: string | null;

  @Column({ type: 'varchar', nullable: true })
  pdfPath: string;

  @Column({ type: 'varchar', nullable: true })
  csvPath: string;

  @Column({ type: 'jsonb', nullable: true })
  summary: {
    accessLogCount: number;
    failedAuthAttemptCount: number;
    dataExportCount: number;
    roleChangeCount: number;
  };

  @Column({ type: 'text', nullable: true })
  errorDetails: string;

  @Column({ type: 'timestamp', nullable: true })
  generatedAt: Date;

  @Column({ type: 'int', default: 0 })
  downloadCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
