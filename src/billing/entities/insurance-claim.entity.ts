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
import { ClaimStatus, ClaimType } from '../../common/enums';
import { Insurance } from './insurance.entity';
import { ClaimDenial } from './claim-denial.entity';

@Entity('insurance_claims')
export class InsuranceClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  claimNumber: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  billingId: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  insuranceId: string;

  @ManyToOne(() => Insurance, (insurance) => insurance.claims)
  @JoinColumn({ name: 'insuranceId' })
  insurance: Insurance;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  patientId: string;

  @Column({
    type: 'varchar',
    enum: ClaimType,
    default: ClaimType.PROFESSIONAL,
  })
  claimType: ClaimType;

  @Column({
    type: 'varchar',
    enum: ClaimStatus,
    default: ClaimStatus.DRAFT,
  })
  @Index()
  status: ClaimStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  payerClaimNumber: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  clearinghouseClaimId: string;

  @Column({ type: 'date' })
  serviceStartDate: Date;

  @Column({ type: 'date' })
  serviceEndDate: Date;

  @Column({ type: 'datetime', nullable: true })
  submittedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  acceptedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  adjudicatedAt: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  billedAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  allowedAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  adjustmentAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  patientResponsibility: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  coinsuranceAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  copayAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  deductibleAmount: number;

  @Column({ type: 'simple-json', nullable: true })
  diagnosisCodes: Array<{
    code: string;
    sequence: number;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  procedureCodes: Array<{
    code: string;
    modifiers?: string[];
    units: number;
    charge: number;
    diagnosisPointers: number[];
  }>;

  @Column({ type: 'simple-json', nullable: true })
  provider: {
    npi: string;
    name: string;
    taxId: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  };

  @Column({ type: 'simple-json', nullable: true })
  facility: {
    npi?: string;
    name: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    placeOfService: string;
  };

  @Column({ type: 'simple-json', nullable: true })
  subscriber: {
    memberId: string;
    name: string;
    dob: string;
    gender: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  };

  @Column({ type: 'simple-json', nullable: true })
  patient: {
    name: string;
    dob: string;
    gender: string;
    relationship: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  };

  @Column({ type: 'text', nullable: true })
  edi837Payload: string;

  @Column({ type: 'text', nullable: true })
  edi835Response: string;

  @Column({ type: 'simple-json', nullable: true })
  submissionHistory: Array<{
    date: string;
    status: string;
    message?: string;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  remarkCodes: Array<{
    code: string;
    description: string;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  adjustmentCodes: Array<{
    groupCode: string;
    reasonCode: string;
    amount: number;
  }>;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'integer', default: 0 })
  submissionAttempts: number;

  @Column({ type: 'date', nullable: true })
  timelyFilingDeadline: Date;

  @OneToMany(() => ClaimDenial, (denial) => denial.claim)
  denials: ClaimDenial[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
