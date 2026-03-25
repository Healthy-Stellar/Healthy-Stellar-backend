import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum DiscrepancyType {
  PATIENT_COUNT_MISMATCH = 'PATIENT_COUNT_MISMATCH',
  RECORD_COUNT_MISMATCH = 'RECORD_COUNT_MISMATCH',
  MISSING_ONCHAIN_RECORD = 'MISSING_ONCHAIN_RECORD',
  EXTRA_CACHED_DATA = 'EXTRA_CACHED_DATA',
  PROVIDER_LIST_MISMATCH = 'PROVIDER_LIST_MISMATCH',
}

export enum ReconciliationStatus {
  OPEN = 'OPEN',
  REPAIRED = 'REPAIRED',
  IRRECONCILABLE = 'IRRECONCILABLE',
}

@Entity('reconciliation_reports')
@Index(['status', 'createdAt'])
@Index(['discrepancyType', 'status'])
export class ReconciliationReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: DiscrepancyType })
  discrepancyType: DiscrepancyType;

  @Column({ type: 'enum', enum: ReconciliationStatus, default: ReconciliationStatus.OPEN })
  status: ReconciliationStatus;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  patientId: string;

  @Column({ type: 'jsonb' })
  offChainSnapshot: Record<string, any>;

  @Column({ type: 'jsonb' })
  onChainSnapshot: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  repairAction: string;

  @Column({ type: 'text', nullable: true })
  adminNote: string;

  @CreateDateColumn()
  createdAt: Date;
}
