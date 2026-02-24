import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum BillingStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  DENIED = 'denied',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  APPEALED = 'appealed',
}

export enum PayerType {
  INSURANCE = 'insurance',
  MEDICARE = 'medicare',
  MEDICAID = 'medicaid',
  SELF_PAY = 'self_pay',
  WORKER_COMP = 'worker_comp',
}

@Entity('telehealth_billing')
@Index(['patientId', 'serviceDate'])
@Index(['virtualVisitId'])
export class TelehealthBilling {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ type: 'uuid' })
  providerId: string;

  @Column({ type: 'uuid' })
  virtualVisitId: string;

  @Column({ type: 'uuid', nullable: true })
  documentId: string;

  @Column({
    type: 'enum',
    enum: BillingStatus,
    default: BillingStatus.PENDING,
  })
  status: BillingStatus;

  @Column({ type: 'date' })
  @Index()
  serviceDate: Date;

  @Column({ type: 'varchar' })
  placeOfService: string; // Usually '02' for telehealth

  @Column({ type: 'jsonb' })
  cptCodes: {
    code: string;
    description: string;
    modifier?: string[]; // e.g., '95' for synchronous telemedicine
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];

  @Column({ type: 'jsonb' })
  diagnosisCodes: {
    code: string; // ICD-10 code
    description: string;
    isPrimary: boolean;
  }[];

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalCharges: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  insurancePayment: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  patientResponsibility: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  adjustments: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amountPaid: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balanceDue: number;

  @Column({
    type: 'enum',
    enum: PayerType,
  })
  payerType: PayerType;

  @Column({ type: 'varchar', nullable: true })
  insuranceCompany: string;

  @Column({ type: 'varchar', nullable: true })
  policyNumber: string;

  @Column({ type: 'varchar', nullable: true })
  groupNumber: string;

  @Column({ type: 'varchar', nullable: true })
  claimNumber: string;

  @Column({ type: 'timestamp', nullable: true })
  claimSubmittedDate: Date;

  @Column({ type: 'varchar', nullable: true })
  authorizationNumber: string;

  @Column({ type: 'boolean', default: false })
  isAuthorizationRequired: boolean;

  @Column({ type: 'boolean', default: false })
  authorizationObtained: boolean;

  @Column({ type: 'integer', nullable: true })
  durationMinutes: number;

  @Column({ type: 'varchar', nullable: true })
  renderingProviderId: string; // NPI

  @Column({ type: 'varchar', nullable: true })
  referringProviderId: string;

  @Column({ type: 'varchar', nullable: true })
  facilityId: string;

  @Column({ type: 'text', nullable: true })
  denialReason: string;

  @Column({ type: 'jsonb', nullable: true })
  denialCodes: string[];

  @Column({ type: 'boolean', default: false })
  isAppealed: boolean;

  @Column({ type: 'timestamp', nullable: true })
  appealDate: Date;

  @Column({ type: 'text', nullable: true })
  appealReason: string;

  @Column({ type: 'jsonb', nullable: true })
  paymentHistory: {
    date: Date;
    amount: number;
    paymentMethod: string;
    transactionId?: string;
    paidBy: 'insurance' | 'patient';
  }[];

  @Column({ type: 'boolean', default: true })
  isTelemedicineCompliant: boolean;

  @Column({ type: 'jsonb', nullable: true })
  complianceChecks: {
    originatingSiteDocumented?: boolean;
    distantSiteDocumented?: boolean;
    consentObtained?: boolean;
    appropriateModifiersUsed?: boolean;
    stateLicenseVerified?: boolean;
  };

  @Column({ type: 'varchar', nullable: true })
  originatingSite: string;

  @Column({ type: 'varchar', nullable: true })
  distantSite: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  remittanceAdvice: {
    adjustmentCodes?: string[];
    remarkCodes?: string[];
    eraDetails?: any;
  };

  @Column({ type: 'timestamp', nullable: true })
  paymentDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
