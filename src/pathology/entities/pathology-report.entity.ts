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

export enum ReportType {
  PRELIMINARY = 'preliminary',
  FINAL = 'final',
  AMENDED = 'amended',
  ADDENDUM = 'addendum',
  SUPPLEMENTAL = 'supplemental',
}

export enum ReportStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  SIGNED = 'signed',
  DISTRIBUTED = 'distributed',
}

@Entity('pathology_reports')
@Index(['reportNumber'])
@Index(['pathologyCaseId'])
export class PathologyReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  reportNumber: string;

  @Column({ type: 'uuid' })
  @Index()
  pathologyCaseId: string;

  @Column({ type: 'uuid', nullable: true })
  templateId: string;

  @Column({
    type: 'enum',
    enum: ReportType,
    default: ReportType.FINAL,
  })
  reportType: ReportType;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.DRAFT,
  })
  status: ReportStatus;

  @Column({ type: 'text' })
  clinicalInformation: string;

  @Column({ type: 'text' })
  grossDescription: string;

  @Column({ type: 'text' })
  microscopicDescription: string;

  @Column({ type: 'text' })
  diagnosis: string;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'jsonb', nullable: true })
  synopticData: Record<string, any>;

  @Column({ type: 'varchar', length: 50, nullable: true })
  tnmStaging: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  marginStatus: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lymphNodeStatus: string;

  @Column({ type: 'jsonb', nullable: true })
  icd10Codes: string[];

  @Column({ type: 'jsonb', nullable: true })
  cptCodes: string[];

  @Column({ type: 'uuid' })
  pathologistId: string;

  @Column({ type: 'varchar', length: 200 })
  pathologistName: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  pathologistSignature: string;

  @Column({ type: 'timestamp', nullable: true })
  signedDate: Date;

  @Column({ type: 'timestamp' })
  reportDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  amendmentHistory: Array<{
    date: Date;
    reason: string;
    changes: string;
    amendedBy: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  distributionList: string[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne('PathologyCase', 'reports')
  @JoinColumn({ name: 'pathologyCaseId' })
  pathologyCase: any;

  @ManyToOne('ReportTemplate', { nullable: true })
  @JoinColumn({ name: 'templateId' })
  template: any;
}
