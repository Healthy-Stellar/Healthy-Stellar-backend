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
import { VerificationStatus, AuthorizationStatus } from '../../common/enums';
import { Insurance } from './insurance.entity';

@Entity('insurance_verifications')
export class InsuranceVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  insuranceId: string;

  @ManyToOne(() => Insurance, (insurance) => insurance.verifications)
  @JoinColumn({ name: 'insuranceId' })
  insurance: Insurance;

  @Column({ type: 'varchar', length: 50 })
  transactionId: string;

  @Column({
    type: 'varchar',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ediTransactionType: string;

  @Column({ type: 'text', nullable: true })
  requestPayload: string;

  @Column({ type: 'text', nullable: true })
  responsePayload: string;

  @Column({ type: 'boolean', default: false })
  isEligible: boolean;

  @Column({ type: 'date', nullable: true })
  coverageStartDate: Date;

  @Column({ type: 'date', nullable: true })
  coverageEndDate: Date;

  @Column({ type: 'simple-json', nullable: true })
  benefitDetails: {
    inNetwork?: {
      deductible?: number;
      deductibleMet?: number;
      copay?: number;
      coinsurance?: number;
      outOfPocketMax?: number;
      outOfPocketMet?: number;
    };
    outOfNetwork?: {
      deductible?: number;
      deductibleMet?: number;
      copay?: number;
      coinsurance?: number;
      outOfPocketMax?: number;
      outOfPocketMet?: number;
    };
  };

  @Column({ type: 'simple-json', nullable: true })
  serviceCoverage: Array<{
    serviceType: string;
    covered: boolean;
    requiresAuth: boolean;
    limitations?: string;
  }>;

  @Column({
    type: 'varchar',
    enum: AuthorizationStatus,
    default: AuthorizationStatus.NOT_REQUIRED,
  })
  authorizationStatus: AuthorizationStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  authorizationNumber: string;

  @Column({ type: 'date', nullable: true })
  authorizationStartDate: Date;

  @Column({ type: 'date', nullable: true })
  authorizationEndDate: Date;

  @Column({ type: 'integer', nullable: true })
  authorizedVisits: number;

  @Column({ type: 'integer', nullable: true })
  usedVisits: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'datetime' })
  verifiedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
