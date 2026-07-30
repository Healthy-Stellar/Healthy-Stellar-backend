import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

export enum FingerprintStatus {
  IMPORTED = 'imported',
  QUARANTINED = 'quarantined',
}

@Entity('import_fingerprints')
@Index(['fingerprint'], { unique: true })
export class ImportFingerprint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** SHA-256 of (sourceSystemId + recordType + recordDate) */
  @Column({ type: 'varchar', length: 64 })
  fingerprint: string;

  @Column({ type: 'enum', enum: FingerprintStatus, default: FingerprintStatus.IMPORTED })
  status: FingerprintStatus;

  @Column({ type: 'uuid' })
  jobId: string;

  /** The raw payload that was first imported / quarantined */
  @Column({ type: 'text' })
  sourceRow: string;

  @CreateDateColumn()
  createdAt: Date;
}
