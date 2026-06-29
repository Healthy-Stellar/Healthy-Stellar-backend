import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('ledger_reconciliation_reports')
@Index(['runAt'])
export class LedgerReconciliationReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp with time zone', name: 'run_at' })
  runAt: Date;

  @Column({ type: 'int', default: 0 })
  accountsChecked: number;

  @Column({ type: 'int', default: 0 })
  matched: number;

  @Column({ type: 'int', default: 0 })
  unmatched: number;

  /** Sum of absolute XLM discrepancies across all accounts (stored as string to preserve precision). */
  @Column({ type: 'varchar', length: 40, default: '0' })
  discrepancyTotal: string;

  @Column({ type: 'boolean', default: false })
  discrepancyThresholdExceeded: boolean;

  @Column({ type: 'boolean', default: false })
  alertSent: boolean;

  /** Per-account breakdown: { accountId, horizonBalance, internalBalance, discrepancy }[] */
  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any>[];
}
