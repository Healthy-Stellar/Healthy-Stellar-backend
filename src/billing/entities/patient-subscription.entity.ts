import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { SubscriptionStatus, SubscriptionCadence } from '../../common/enums';
import { SubscriptionPlan } from './subscription-plan.entity';
import { Billing } from './billing.entity';

@Entity('patient_subscriptions')
export class PatientSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ type: 'varchar', length: 200 })
  patientName: string;

  @Column({ type: 'uuid' })
  @Index()
  planId: string;

  @ManyToOne(() => SubscriptionPlan, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'planId' })
  plan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  @Index()
  status: SubscriptionStatus;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'date' })
  currentPeriodStart: Date;

  @Column({ type: 'date' })
  currentPeriodEnd: Date;

  @Column({
    type: 'enum',
    enum: SubscriptionCadence,
  })
  cadence: SubscriptionCadence;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  currentPrice: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'int', default: 0 })
  consecutiveFailedPayments: number;

  @Column({ type: 'int', default: 3 })
  maxFailedPaymentsBeforeSuspension: number;

  @Column({ type: 'date', nullable: true })
  lastPaymentDate: Date;

  @Column({ type: 'date', nullable: true })
  nextBillingDate: Date;

  @Column({ type: 'date', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string;

  @Column({ type: 'boolean', default: false })
  autoRenew: boolean;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => Billing, (billing) => billing.subscription)
  invoices: Billing[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
