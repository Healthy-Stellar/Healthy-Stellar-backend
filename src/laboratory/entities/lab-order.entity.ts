import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { LabOrderItem } from './lab-order-item.entity';
import { Specimen } from './specimen.entity';

export enum OrderStatus {
  ORDERED = 'ordered',
  COLLECTED = 'collected',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  VERIFIED = 'verified',
  CANCELLED = 'cancelled',
}

export enum OrderPriority {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  STAT = 'stat',
  ASAP = 'asap',
}

@Entity('lab_orders')
export class LabOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  orderNumber: string;

  @Column()
  @Index()
  patientId: string;

  @Column({ nullable: true })
  patientName: string;

  @Column({ nullable: true })
  providerId: string;

  @Column({ nullable: true })
  @Index()
  orderingProviderId: string;

  @Column({ nullable: true })
  orderingProviderName: string;

  @Column('simple-json', { nullable: true })
  tests: Array<{ testId: string; testCode: string; testName: string }>;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.ORDERED })
  status: OrderStatus;

  @Column({ type: 'enum', enum: OrderPriority, default: OrderPriority.ROUTINE })
  priority: OrderPriority;

  @Column('date')
  orderDate: Date;

  @Column('date', { nullable: true })
  collectionDate: Date;

  @Column('date', { nullable: true })
  completedDate: Date;

  @Column('date', { nullable: true })
  verifiedDate: Date;

  @Column('date', { nullable: true })
  cancelledDate: Date;

  @Column('text', { nullable: true })
  cancellationReason: string;

  @Column({ nullable: true })
  cancelledBy: string;

  @Column({ nullable: true })
  specimenId: string;

  @Column('text', { nullable: true })
  clinicalInfo: string;

  @Column('text', { nullable: true })
  clinicalIndication: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column({ nullable: true })
  @Index()
  departmentId: string;

  @Column({ nullable: true })
  departmentName: string;

  @Column('simple-json', { nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => LabOrderItem, (item) => item.labOrder)
  items: LabOrderItem[];

  @OneToMany(() => Specimen, (specimen) => specimen.order)
  specimens: Specimen[];
}
