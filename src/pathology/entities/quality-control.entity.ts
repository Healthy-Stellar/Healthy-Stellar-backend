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

export enum QCType {
  PEER_REVIEW = 'peer_review',
  RANDOM_REVIEW = 'random_review',
  TARGETED_REVIEW = 'targeted_review',
  CORRELATION = 'correlation',
  FROZEN_SECTION_REVIEW = 'frozen_section_review',
}

export enum DiscrepancySeverity {
  NONE = 'none',
  MINOR = 'minor',
  MAJOR = 'major',
  CRITICAL = 'critical',
}

@Entity('quality_control_logs')
@Index(['pathologyCaseId'])
@Index(['reviewDate'])
export class QualityControlLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  pathologyCaseId: string;

  @Column({
    type: 'enum',
    enum: QCType,
  })
  qcType: QCType;

  @Column({ type: 'uuid' })
  reviewerId: string;

  @Column({ type: 'varchar', length: 200 })
  reviewerName: string;

  @Column({ type: 'timestamp' })
  @Index()
  reviewDate: Date;

  @Column({ type: 'text' })
  findings: string;

  @Column({ type: 'text', nullable: true })
  discrepancies: string;

  @Column({
    type: 'enum',
    enum: DiscrepancySeverity,
    default: DiscrepancySeverity.NONE,
  })
  severity: DiscrepancySeverity;

  @Column({ type: 'text', nullable: true })
  actionTaken: string;

  @Column({ type: 'boolean', default: false })
  followUpRequired: boolean;

  @Column({ type: 'timestamp', nullable: true })
  resolutionDate: Date;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string;

  @Column({ type: 'boolean', default: false })
  educationalValue: boolean;

  @Column({ type: 'text', nullable: true })
  educationalNotes: string;

  @Column({ type: 'boolean', default: true })
  agreement: boolean;

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
  @ManyToOne('PathologyCase', 'qualityControlLogs')
  @JoinColumn({ name: 'pathologyCaseId' })
  pathologyCase: any;
}
