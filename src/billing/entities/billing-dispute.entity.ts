import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum DisputeStatus {
  OPEN = 'OPEN',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
  WRITTEN_OFF = 'WRITTEN_OFF',
}

@Entity('billing_disputes')
export class BillingDispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  remittanceId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  claimId: string;

  @Column({ type: 'text' })
  notes: string;

  @Column({
    type: 'varchar',
    enum: DisputeStatus,
    default: DisputeStatus.OPEN,
  })
  @Index()
  status: DisputeStatus;

  @Column({ type: 'varchar', length: 200 })
  createdBy: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  resolvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
