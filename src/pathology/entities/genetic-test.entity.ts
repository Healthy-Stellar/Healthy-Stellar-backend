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

export enum ACMGClassification {
  PATHOGENIC = 'pathogenic',
  LIKELY_PATHOGENIC = 'likely_pathogenic',
  UNCERTAIN_SIGNIFICANCE = 'uncertain_significance',
  LIKELY_BENIGN = 'likely_benign',
  BENIGN = 'benign',
}

export enum InheritancePattern {
  AUTOSOMAL_DOMINANT = 'autosomal_dominant',
  AUTOSOMAL_RECESSIVE = 'autosomal_recessive',
  X_LINKED = 'x_linked',
  MITOCHONDRIAL = 'mitochondrial',
  MULTIFACTORIAL = 'multifactorial',
}

@Entity('genetic_tests')
@Index(['testNumber'])
@Index(['pathologyCaseId'])
export class GeneticTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  testNumber: string;

  @Column({ type: 'uuid' })
  @Index()
  pathologyCaseId: string;

  @Column({ type: 'varchar', length: 200 })
  testPanelName: string;

  @Column({ type: 'jsonb' })
  genesAnalyzed: string[];

  @Column({ type: 'jsonb', nullable: true })
  variantsDetected: Array<{
    gene: string;
    variant: string;
    zygosity: string;
    classification: ACMGClassification;
  }>;

  @Column({
    type: 'enum',
    enum: ACMGClassification,
    nullable: true,
  })
  overallClassification: ACMGClassification;

  @Column({ type: 'text', nullable: true })
  clinicalSignificance: string;

  @Column({
    type: 'enum',
    enum: InheritancePattern,
    nullable: true,
  })
  inheritancePattern: InheritancePattern;

  @Column({ type: 'text', nullable: true })
  recommendations: string;

  @Column({ type: 'text', nullable: true })
  geneticCounselorNotes: string;

  @Column({ type: 'boolean', default: false })
  consentDocumented: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  consentFormPath: string;

  @Column({ type: 'timestamp' })
  orderedDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedDate: Date;

  @Column({ type: 'uuid', nullable: true })
  reviewingGeneticistId: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reviewingGeneticistName: string;

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
  @ManyToOne('PathologyCase', 'geneticTests')
  @JoinColumn({ name: 'pathologyCaseId' })
  pathologyCase: any;
}
