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
import { Billing } from './billing.entity';

@Entity('billing_line_items')
export class BillingLineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  billingId: string;

  @ManyToOne(() => Billing, (billing) => billing.lineItems)
  @JoinColumn({ name: 'billingId' })
  billing: Billing;

  @Column({ type: 'integer' })
  lineNumber: number;

  @Column({ type: 'date' })
  serviceDate: Date;

  @Column({ type: 'date', nullable: true })
  serviceDateEnd: Date;

  @Column({ type: 'varchar', length: 10 })
  cptCode: string;

  @Column({ type: 'varchar', length: 200 })
  cptDescription: string;

  @Column({ type: 'simple-array', nullable: true })
  modifiers: string[];

  @Column({ type: 'simple-array', nullable: true })
  diagnosisCodes: string[];

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 1 })
  units: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitCharge: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalCharge: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  allowedAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  adjustmentAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  patientResponsibility: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  revenueCode: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  ndc: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
