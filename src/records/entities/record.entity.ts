import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { RecordType } from '../dto/create-record.dto';

@Entity('records')
export class Record {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column({ nullable: true })
  providerId: string;

  @Column()
  cid: string;

  @Column({ nullable: true })
  stellarTxHash: string;

  @Column({ type: 'enum', enum: RecordType })
  recordType: RecordType;

  @Column({ nullable: true })
  description: string;

  /** Soft-delete flag mirrored from the on-chain record_deleted event */
  @Column({ default: false })
  @Index()
  isDeleted: boolean;

  /** Timestamp of the on-chain deletion event (null until deleted) */
  @Column({ type: 'timestamp with time zone', nullable: true })
  deletedOnChainAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
