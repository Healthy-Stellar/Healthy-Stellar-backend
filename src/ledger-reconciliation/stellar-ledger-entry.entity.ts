import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Tracks internal ledger entries for Stellar account balance reconciliation.
 * Each entry represents a confirmed or pending payment amount for a specific account.
 */
@Entity('stellar_ledger_entries')
@Index(['accountId', 'status'])
@Index(['createdAt'])
export class StellarLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', name: 'account_id' })
  accountId: string;

  @Column({
    type: 'numeric',
    precision: 19,
    scale: 7,
    comment: 'Amount in XLM',
  })
  amount: string;

  @Column({
    type: 'varchar',
    default: 'confirmed',
    comment: 'Status: confirmed or pending',
  })
  status: 'confirmed' | 'pending';

  @Column({
    type: 'varchar',
    name: 'tx_hash',
    nullable: true,
    comment: 'Associated Stellar transaction hash if applicable',
  })
  txHash?: string;

  @CreateDateColumn({
    type: 'timestamp with time zone',
    name: 'created_at',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp with time zone',
    name: 'updated_at',
  })
  updatedAt: Date;
}
