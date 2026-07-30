import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum RemittanceStatus {
  MATCHED = 'MATCHED',
  UNMATCHED = 'UNMATCHED',
  DISCREPANCY = 'DISCREPANCY',
}

@Entity('remittances')
export class Remittance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  claimId: string;

  @Column({ type: 'varchar', length: 200 })
  payerName: string;

  @Column({ type: 'date' })
  remittanceDate: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  billedAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  adjustmentAmount: number;

  @Column({
    type: 'varchar',
    enum: RemittanceStatus,
    default: RemittanceStatus.UNMATCHED,
  })
  @Index()
  status: RemittanceStatus;

  @Column({ type: 'text', nullable: true })
  discrepancyReason: string;

  @Column({ type: 'simple-json', nullable: true })
  raw: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
