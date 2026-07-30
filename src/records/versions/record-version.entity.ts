import { Entity, Column, Index, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('record_versions')
@Index(['recordId', 'version'], { unique: true })
@Index(['recordId', 'createdAt'])
export class RecordVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Index()
  @Column({ name: 'record_id' })
  recordId: string;

  @Column({ type: 'int' })
  version: number;

  @Column()
  cid: string;

  @Column({ name: 'encrypted_dek' })
  encryptedDek: string;

  @Column({ name: 'stellar_tx_hash', nullable: true })
  stellarTxHash: string | null;

  @Column({ name: 'amended_by' })
  amendedBy: string;

  @Column({ name: 'amendment_reason' })
  amendmentReason: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt: Date;
}
