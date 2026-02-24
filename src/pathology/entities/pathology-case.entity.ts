import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

export enum CaseType {
  SURGICAL = 'surgical',
  CYTOLOGY = 'cytology',
  AUTOPSY = 'autopsy',
  CONSULTATION = 'consultation',
  FROZEN_SECTION = 'frozen_section',
}

export enum CaseStatus {
  RECEIVED = 'received',
  ACCESSIONING = 'accessioning',
  GROSSING = 'grossing',
  PROCESSING = 'processing',
  EMBEDDING = 'embedding',
  CUTTING = 'cutting',
  STAINING = 'staining',
  MICROSCOPY = 'microscopy',
  DIAGNOSIS = 'diagnosis',
  PEER_REVIEW = 'peer_review',
  FINALIZED = 'finalized',
  AMENDED = 'amended',
}

export enum CasePriority {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  STAT = 'stat',
  FROZEN = 'frozen',
}

@Entity('pathology_cases')
@Index(['caseNumber'])
@Index(['patientId', 'caseDate'])
@Index(['status', 'priority'])
export class PathologyCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  caseNumber: string;

  @Column({ type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ type: 'varchar', length: 200 })
  patientName: string;

  @Column({ type: 'uuid' })
  orderingPhysicianId: string;

  @Column({ type: 'varchar', length: 200 })
  orderingPhysicianName: string;

  @Column({ type: 'uuid', nullable: true })
  pathologistId: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  pathologistName: string;

  @Column({ type: 'uuid', nullable: true })
  reviewPathologistId: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reviewPathologistName: string;

  @Column({
    type: 'enum',
    enum: CaseType,
    default: CaseType.SURGICAL,
  })
  caseType: CaseType;

  @Column({
    type: 'enum',
    enum: CaseStatus,
    default: CaseStatus.RECEIVED,
  })
  status: CaseStatus;

  @Column({
    type: 'enum',
    enum: CasePriority,
    default: CasePriority.ROUTINE,
  })
  priority: CasePriority;

  @Column({ type: 'timestamp' })
  caseDate: Date;

  @Column({ type: 'text' })
  clinicalHistory: string;

  @Column({ type: 'text', nullable: true })
  clinicalIndication: string;

  @Column({ type: 'text', nullable: true })
  grossDescription: string;

  @Column({ type: 'text', nullable: true })
  microscopicFindings: string;

  @Column({ type: 'text', nullable: true })
  diagnosis: string;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'jsonb', nullable: true })
  icdCodes: string[];

  @Column({ type: 'jsonb', nullable: true })
  cptCodes: string[];

  @Column({ type: 'timestamp', nullable: true })
  receivedDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  accessionedDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  grossingDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  diagnosisDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  finalizedDate: Date;

  @Column({ type: 'int', nullable: true })
  turnaroundTimeHours: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  departmentId: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  departmentName: string;

  @Column({ type: 'boolean', default: false })
  consultationRequested: boolean;

  @Column({ type: 'text', nullable: true })
  consultationNotes: string;

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
  @OneToMany('PathologySpecimen', 'pathologyCase', {
    cascade: true,
  })
  specimens: any[];

  @OneToMany('HistologySlide', 'pathologyCase')
  histologySlides: any[];

  @OneToMany('CytologySlide', 'pathologyCase')
  cytologySlides: any[];

  @OneToMany('DigitalImage', 'pathologyCase')
  digitalImages: any[];

  @OneToMany('PathologyReport', 'pathologyCase')
  reports: any[];

  @OneToMany('MolecularTest', 'pathologyCase')
  molecularTests: any[];

  @OneToMany('GeneticTest', 'pathologyCase')
  geneticTests: any[];

  @OneToMany('QualityControlLog', 'pathologyCase')
  qualityControlLogs: any[];
}
