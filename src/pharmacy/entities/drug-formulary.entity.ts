import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Drug } from './drug.entity';

export enum FormularyTier {
  TIER_1 = 'tier_1', // Preferred generic
  TIER_2 = 'tier_2', // Preferred brand
  TIER_3 = 'tier_3', // Non-preferred brand
  TIER_4 = 'tier_4', // Specialty drugs
  NOT_COVERED = 'not_covered',
}

export enum FormularyStatus {
  COVERED = 'covered',
  PRIOR_AUTH = 'prior_authorization',
  STEP_THERAPY = 'step_therapy',
  QUANTITY_LIMIT = 'quantity_limit',
  NOT_COVERED = 'not_covered',
}

@Entity('drug_formulary')
export class DrugFormulary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Drug)
  @JoinColumn({ name: 'drug_id' })
  drug: Drug;

  @Column()
  drugId: string;

  @Column()
  insurancePlan: string; // Insurance plan name/ID

  @Column({
    type: 'enum',
    enum: FormularyTier,
    default: FormularyTier.TIER_3,
  })
  tier: FormularyTier;

  @Column({
    type: 'enum',
    enum: FormularyStatus,
    default: FormularyStatus.COVERED,
  })
  status: FormularyStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  copayAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  coinsurancePercent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  deductibleAmount: number;

  @Column({ type: 'int', nullable: true })
  quantityLimit: number; // per fill or per month

  @Column({ nullable: true })
  quantityLimitPeriod: string; // 'per_fill', 'per_month', 'per_year'

  @Column('simple-array', { nullable: true })
  priorAuthCriteria: string[];

  @Column('simple-array', { nullable: true })
  stepTherapyRequirements: string[];

  @Column('simple-array', { nullable: true })
  preferredAlternatives: string[]; // Alternative drug IDs

  @Column('text', { nullable: true })
  notes: string;

  @Column({ type: 'date', nullable: true })
  effectiveDate: Date;

  @Column({ type: 'date', nullable: true })
  expirationDate: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
