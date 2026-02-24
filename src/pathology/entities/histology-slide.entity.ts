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

export enum StainType {
  HE = 'H&E',
  PAS = 'PAS',
  TRICHROME = 'Trichrome',
  GIEMSA = 'Giemsa',
  GRAM = 'Gram',
  AFB = 'AFB',
  IHC = 'IHC',
  SPECIAL = 'Special',
}

export enum SlideQuality {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  ADEQUATE = 'adequate',
  POOR = 'poor',
  UNSATISFACTORY = 'unsatisfactory',
}

@Entity('histology_slides')
@Index(['slideNumber'])
@Index(['pathologyCaseId'])
export class HistologySlide {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  slideNumber: string;

  @Column({ type: 'uuid' })
  @Index()
  pathologyCaseId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  specimenId: string;

  @Column({ type: 'varchar', length: 50 })
  blockNumber: string;

  @Column({ type: 'int', default: 1 })
  sectionNumber: number;

  @Column({
    type: 'enum',
    enum: StainType,
    default: StainType.HE,
  })
  stainType: StainType;

  @Column({ type: 'varchar', length: 200, nullable: true })
  ihcMarker: string;

  @Column({ type: 'timestamp', nullable: true })
  stainDate: Date;

  @Column({ type: 'uuid', nullable: true })
  technicianId: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  technicianName: string;

  @Column({
    type: 'enum',
    enum: SlideQuality,
    default: SlideQuality.GOOD,
  })
  quality: SlideQuality;

  @Column({ type: 'boolean', default: false })
  recutRequired: boolean;

  @Column({ type: 'text', nullable: true })
  recutReason: string;

  @Column({ type: 'int', nullable: true })
  thicknessMicrons: number;

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
  @ManyToOne('PathologyCase', 'histologySlides')
  @JoinColumn({ name: 'pathologyCaseId' })
  pathologyCase: any;

  @OneToMany('DigitalImage', 'histologySlide')
  digitalImages: any[];
}
