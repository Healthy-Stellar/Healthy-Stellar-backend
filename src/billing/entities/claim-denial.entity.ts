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
import { DenialReason } from '../../common/enums';
import { InsuranceClaim } from './insurance-claim.entity';
import { ClaimAppeal } from './claim-appeal.entity';

@Entity('claim_denials')
export class ClaimDenial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  denialNumber: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  claimId: string;

  @ManyToOne(() => InsuranceClaim, (claim) => claim.denials)
  @JoinColumn({ name: 'claimId' })
  claim: InsuranceClaim;

  @Column({ type: 'date' })
  denialDate: Date;

  @Column({
    type: 'varchar',
    enum: DenialReason,
  })
  primaryReason: DenialReason;

  @Column({ type: 'simple-array', nullable: true })
  additionalReasons: string[];

  @Column({ type: 'simple-json', nullable: true })
  denialCodes: Array<{
    code: string;
    description: string;
    category: string;
  }>;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  deniedAmount: number;

  @Column({ type: 'text', nullable: true })
  payerExplanation: string;

  @Column({ type: 'text', nullable: true })
  internalNotes: string;

  @Column({ type: 'boolean', default: false })
  isAppealable: boolean;

  @Column({ type: 'date', nullable: true })
  appealDeadline: Date;

  @Column({ type: 'boolean', default: false })
  isResolved: boolean;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  resolutionType: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  recoveredAmount: number;

  @Column({ type: 'simple-json', nullable: true })
  requiredActions: Array<{
    action: string;
    dueDate?: string;
    completedAt?: string;
    notes?: string;
  }>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  assignedTo: string;

  @Column({ type: 'integer', default: 1 })
  priority: number;

  @OneToMany(() => ClaimAppeal, (appeal) => appeal.denial)
  appeals: ClaimAppeal[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
