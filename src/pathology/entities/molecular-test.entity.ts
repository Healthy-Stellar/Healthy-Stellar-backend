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

export enum MolecularTestType {
  PCR = 'pcr',
  FISH = 'fish',
  NGS = 'ngs',
  SANGER = 'sanger',
  MICROARRAY = 'microarray',
  FLOW_CYTOMETRY = 'flow_cytometry',
  IHC = 'ihc',
  OTHER = 'other',
}

export enum TestStatus {
  ORDERED = 'ordered',
  SPECIMEN_RECEIVED = 'specimen_received',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REVIEWED = 'reviewed',
  CANCELLED = 'cancelled',
}

@Entity('molecular_tests')
@Index(['testNumber'])
@Index(['pathologyCaseId'])
export class MolecularTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  testNumber: string;

  @Column({ type: 'uuid' })
  @Index()
  pathologyCaseId: string;

  @Column({
    type: 'enum',
    enum: MolecularTestType,
  })
  testType: MolecularTestType;

  @Column({ type: 'varchar', length: 200 })
  testName: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  geneMarker: string;

  @Column({ type: 'text' })
  methodology: string;

  @Column({ type: 'varchar', length: 100 })
  specimenType: string;

  @Column({ type: 'text' })
  indication: string;

  @Column({
    type: 'enum',
    enum: TestStatus,
    default: TestStatus.ORDERED,
  })
  status: TestStatus;

  @Column({ type: 'timestamp' })
  orderedDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedDate: Date;

  @Column({ type: 'text', nullable: true })
  result: string;

  @Column({ type: 'text', nullable: true })
  interpretation: string;

  @Column({ type: 'jsonb', nullable: true })
  referenceRanges: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  technologistId: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  technologistName: string;

  @Column({ type: 'uuid', nullable: true })
  reviewingPathologistId: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reviewingPathologistName: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  externalLab: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalLabAccession: string;

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
  @ManyToOne('PathologyCase', 'molecularTests')
  @JoinColumn({ name: 'pathologyCaseId' })
  pathologyCase: any;
}
