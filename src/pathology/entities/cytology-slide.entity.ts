import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

export enum CytologySpecimenType {
  PAP_SMEAR = 'pap_smear',
  FNA = 'fna',
  BODY_FLUID = 'body_fluid',
  URINE = 'urine',
  BRONCHIAL_WASHING = 'bronchial_washing',
  CSF = 'csf',
  OTHER = 'other',
}

export enum PreparationMethod {
  THINPREP = 'thinprep',
  SUREPATH = 'surepath',
  CONVENTIONAL = 'conventional',
  LIQUID_BASED = 'liquid_based',
}

export enum AdequacyStatus {
  SATISFACTORY = 'satisfactory',
  UNSATISFACTORY = 'unsatisfactory',
  LIMITED = 'limited',
}

export enum BethesdaClassification {
  NILM = 'NILM',
  ASC_US = 'ASC-US',
  ASC_H = 'ASC-H',
  LSIL = 'LSIL',
  HSIL = 'HSIL',
  AGC = 'AGC',
  CARCINOMA = 'Carcinoma',
}

@Entity('cytology_slides')
@Index(['slideNumber'])
@Index(['pathologyCaseId'])
export class CytologySlide {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  slideNumber: string;

  @Column({ type: 'uuid' })
  @Index()
  pathologyCaseId: string;

  @Column({
    type: 'enum',
    enum: CytologySpecimenType,
  })
  specimenType: CytologySpecimenType;

  @Column({
    type: 'enum',
    enum: PreparationMethod,
  })
  preparationMethod: PreparationMethod;

  @Column({
    type: 'enum',
    enum: AdequacyStatus,
  })
  adequacy: AdequacyStatus;

  @Column({ type: 'text', nullable: true })
  adequacyComment: string;

  @Column({
    type: 'enum',
    enum: BethesdaClassification,
    nullable: true,
  })
  bethesdaClassification: BethesdaClassification;

  @Column({ type: 'uuid', nullable: true })
  screeningCytotechId: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  screeningCytotechName: string;

  @Column({ type: 'timestamp', nullable: true })
  screeningDate: Date;

  @Column({ type: 'uuid', nullable: true })
  reviewingPathologistId: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reviewingPathologistName: string;

  @Column({ type: 'timestamp', nullable: true })
  reviewDate: Date;

  @Column({ type: 'text', nullable: true })
  findings: string;

  @Column({ type: 'text', nullable: true })
  interpretation: string;

  @Column({ type: 'text', nullable: true })
  recommendation: string;

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
  @ManyToOne('PathologyCase', 'cytologySlides')
  @JoinColumn({ name: 'pathologyCaseId' })
  pathologyCase: any;

  @OneToMany('DigitalImage', 'cytologySlide')
  digitalImages: any[];
}
