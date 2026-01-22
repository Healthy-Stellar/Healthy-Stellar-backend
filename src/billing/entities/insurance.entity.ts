import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { InsuranceType, PayerType, VerificationStatus } from '../../common/enums';
import { InsuranceClaim } from './insurance-claim.entity';
import { InsuranceVerification } from './insurance-verification.entity';

@Entity('insurances')
export class Insurance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  patientId: string;

  @Column({ type: 'varchar', length: 200 })
  payerName: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  payerId: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  memberId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  groupNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  groupName: string;

  @Column({
    type: 'varchar',
    enum: InsuranceType,
    default: InsuranceType.PRIMARY,
  })
  insuranceType: InsuranceType;

  @Column({
    type: 'varchar',
    enum: PayerType,
    default: PayerType.COMMERCIAL,
  })
  payerType: PayerType;

  @Column({ type: 'varchar', length: 100 })
  subscriberName: string;

  @Column({ type: 'varchar', length: 20 })
  subscriberRelationship: string;

  @Column({ type: 'date', nullable: true })
  subscriberDob: Date;

  @Column({ type: 'date' })
  effectiveDate: Date;

  @Column({ type: 'date', nullable: true })
  terminationDate: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  planType: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  copay: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  deductible: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  deductibleMet: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  outOfPocketMax: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  outOfPocketMet: number;

  @Column({ type: 'integer', nullable: true })
  coinsurancePercentage: number;

  @Column({
    type: 'varchar',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verificationStatus: VerificationStatus;

  @Column({ type: 'datetime', nullable: true })
  lastVerifiedAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'simple-json', nullable: true })
  coverageDetails: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  contactInfo: {
    phone?: string;
    fax?: string;
    email?: string;
    address?: string;
  };

  @OneToMany(() => InsuranceClaim, (claim) => claim.insurance)
  claims: InsuranceClaim[];

  @OneToMany(() => InsuranceVerification, (verification) => verification.insurance)
  verifications: InsuranceVerification[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
