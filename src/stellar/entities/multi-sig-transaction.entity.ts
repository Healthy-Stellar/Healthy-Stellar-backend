import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { MultiSigTransactionStatus, SignerEntry } from '../interfaces/multi-sig.interface';

@Entity('multi_sig_transactions')
@Index(['tenantId', 'status'])
@Index(['status', 'expiresAt'])
export class MultiSigTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  @Index()
  tenantId: string;

  @Column()
  destination: string;

  @Column({ type: 'varchar', length: 50 })
  amount: string;

  @Column({ default: 'XLM' })
  asset: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: MultiSigTransactionStatus.PENDING_SIGNATURES,
  })
  status: MultiSigTransactionStatus;

  @Column({ default: 2 })
  threshold: number;

  @Column({ name: 'total_signers', default: 3 })
  totalSigners: number;

  @Column({ name: 'ttl_minutes', default: 60 })
  ttlMinutes: number;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'stellar_tx_hash', nullable: true })
  stellarTxHash: string;

  @Column({ type: 'text', nullable: true })
  xdr: string;

  @Column({ name: 'requester_id' })
  requesterId: string;

  @Column({ type: 'json', nullable: true })
  signatures: SignerEntry[];

  @Column({ nullable: true })
  memo: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
