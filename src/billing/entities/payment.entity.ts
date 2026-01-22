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
import { PaymentStatus, PaymentMethod } from '../../common/enums';
import { Billing } from './billing.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  paymentNumber: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  billingId: string;

  @ManyToOne(() => Billing, (billing) => billing.payments)
  @JoinColumn({ name: 'billingId' })
  billing: Billing;

  @Column({ type: 'varchar', length: 100, nullable: true })
  claimId: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  patientId: string;

  @Column({
    type: 'varchar',
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  @Column({
    type: 'varchar',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  @Index()
  status: PaymentStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  refundedAmount: number;

  @Column({ type: 'date' })
  paymentDate: Date;

  @Column({ type: 'date', nullable: true })
  postedDate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  payerName: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  payerId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  checkNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  transactionId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  eraNumber: string;

  @Column({ type: 'boolean', default: false })
  isPatientPayment: boolean;

  @Column({ type: 'boolean', default: false })
  isInsurancePayment: boolean;

  @Column({ type: 'simple-json', nullable: true })
  paymentAllocation: Array<{
    lineItemId: string;
    amount: number;
    adjustmentAmount?: number;
    adjustmentReason?: string;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  cardDetails: {
    lastFour?: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
  };

  @Column({ type: 'simple-json', nullable: true })
  achDetails: {
    bankName?: string;
    accountLastFour?: string;
    routingLastFour?: string;
  };

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  processedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
