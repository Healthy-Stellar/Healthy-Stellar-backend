import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { LabOrder } from './lab-order.entity';
import { LabTest } from './lab-test.entity';
import { LabResult } from './lab-result.entity';

export enum OrderItemStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('lab_order_items')
@Index(['labOrderId'])
@Index(['labTestId'])
export class LabOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  labOrderId: string;

  @Column({ type: 'uuid' })
  labTestId: string;

  @Column({
    type: 'enum',
    enum: OrderItemStatus,
    default: OrderItemStatus.PENDING,
  })
  status: OrderItemStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => LabOrder, (order) => order.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'labOrderId' })
  labOrder: LabOrder;

  @ManyToOne(() => LabTest)
  @JoinColumn({ name: 'labTestId' })
  labTest: LabTest;

  @OneToOne(() => LabResult, (result) => result.orderItem)
  result: LabResult;
}
