import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/**
 * Immutable version history for a record.
 * Every amendment creates a new row; rows are never updated or deleted.
 * Version numbers are sequential integers starting at 1 and are never reused.
 * Version 1 is the original upload and is protected from deletion.
 */
@Entity('record_versions')
@Unique('UQ_record_versions_record_version', ['recordId', 'version'])
export class RecordVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'recordId' })
  @Index('IDX_record_versions_recordId')
  recordId: string;

  /** Sequential version number starting at 1. Never skipped or reused. */
  @Column({ type: 'integer' })
  version: number;

  /** IPFS Content Identifier for this version's encrypted file. */
  @Column()
  cid: string;

  /** Encrypted data-encryption key (DEK) for this version's file. Nullable for backward compat. */
  @Column({ type: 'text', nullable: true })
  encryptedDek: string | null;

  /** Stellar transaction hash anchoring this version's CID on-chain. */
  @Column({ nullable: true })
  stellarTxHash: string | null;

  /** ID of the user who created / amended this version. */
  @Column()
  amendedBy: string;

  /** Human-readable reason for the amendment (min 20 chars). 'Initial upload' for v1. */
  @Column({ type: 'text' })
  amendmentReason: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}
