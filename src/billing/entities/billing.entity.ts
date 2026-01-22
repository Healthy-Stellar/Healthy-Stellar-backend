import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { BillingLineItem } from './billing-line-item.entity';
import { Payment } from './payment.entity';

@Entity('billings')
export class Billing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  invoiceNumber: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  patientId: string;

  @Column({ type: 'varchar', length: 200 })
  patientName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  encounterId: string;

  @Column({ type: 'date' })
  serviceDate: Date;

  @Column({ type: 'varchar', length: 100 })
  providerId: string;

  @Column({ type: 'varchar', length: 200 })
  providerName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  providerNpi: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  facilityId: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  facilityName: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  placeOfService: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalCharges: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAdjustments: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalPayments: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  patientResponsibility: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  insuranceResponsibility: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: string;

  @Column({ type: 'date', nullable: true })
  dueDate: Date;

  @Column({ type: 'boolean', default: false })
  isSentToCollections: boolean;

  @Column({ type: 'date', nullable: true })
  sentToCollectionsDate: Date;

  @Column({ type: 'simple-json', nullable: true })
  diagnosisCodes: Array<{
    code: string;
    description: string;
    isPrimary: boolean;
  }>;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => BillingLineItem, (lineItem) => lineItem.billing, {
    cascade: true,
  })
  lineItems: BillingLineItem[];

  @OneToMany(() => Payment, (payment) => payment.billing)
  payments: Payment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
