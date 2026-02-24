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

export enum SpecimenType {
  TISSUE = 'tissue',
  FLUID = 'fluid',
  CYTOLOGY = 'cytology',
  BONE_MARROW = 'bone_marrow',
  BLOOD = 'blood',
}

export enum FixativeType {
  FORMALIN = 'formalin',
  ALCOHOL = 'alcohol',
  FRESH = 'fresh',
  FROZEN = 'frozen',
  OTHER = 'other',
}

@Entity('pathology_specimens')
@Index(['specimenNumber'])
@Index(['pathologyCaseId'])
export class PathologySpecimen {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  specimenNumber: string;

  @Column({ type: 'uuid' })
  @Index()
  pathologyCaseId: string;

  @Column({
    type: 'enum',
    enum: SpecimenType,
  })
  specimenType: SpecimenType;

  @Column({ type: 'varchar', length: 200 })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  site: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  containerType: string;

  @Column({
    type: 'enum',
    enum: FixativeType,
    default: FixativeType.FORMALIN,
  })
  fixative: FixativeType;

  @Column({ type: 'timestamp', nullable: true })
  collectionDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  receivedDate: Date;

  @Column({ type: 'int', nullable: true })
  timeInFixativeHours: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  processingProtocol: string;

  @Column({ type: 'int', default: 0 })
  numberOfBlocks: number;

  @Column({ type: 'int', default: 0 })
  numberOfSlides: number;

  @Column({ type: 'uuid', nullable: true })
  processingTechnician: string;

  @Column({ type: 'timestamp', nullable: true })
  processingStartTime: Date;

  @Column({ type: 'timestamp', nullable: true })
  processingEndTime: Date;

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
  @ManyToOne('PathologyCase', 'specimens')
  @JoinColumn({ name: 'pathologyCaseId' })
  pathologyCase: any;
}
