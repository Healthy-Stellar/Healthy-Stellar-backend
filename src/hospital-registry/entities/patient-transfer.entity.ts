import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { HospitalRegistry } from './hospital-registry.entity';

export enum TransferStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('patient_transfers')
@Index(['patientId', 'status'])
@Index(['fromHospitalId', 'status'])
@Index(['toHospitalId', 'status'])
export class PatientTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'patient_name', type: 'varchar', length: 255 })
  patientName: string;

  @Column({ name: 'from_hospital_id', type: 'uuid' })
  fromHospitalId: string;

  @ManyToOne(() => HospitalRegistry)
  @JoinColumn({ name: 'from_hospital_id' })
  fromHospital: HospitalRegistry;

  @Column({ name: 'to_hospital_id', type: 'uuid' })
  toHospitalId: string;

  @ManyToOne(() => HospitalRegistry)
  @JoinColumn({ name: 'to_hospital_id' })
  toHospital: HospitalRegistry;

  @Column({
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.PENDING,
  })
  status: TransferStatus;

  @Column({ name: 'transfer_reason', type: 'text', nullable: true })
  transferReason: string;

  @Column({ name: 'consented_at', type: 'timestamp', nullable: true })
  consentedAt: Date;

  @Column({ name: 'consented_by', type: 'uuid', nullable: true })
  consentedBy: string;

  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt: Date;

  @Column({ name: 'accepted_by', type: 'uuid', nullable: true })
  acceptedBy: string;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date;

  /** Stellar transaction hash for the immutable transfer receipt */
  @Column({ name: 'stellar_tx_hash', type: 'varchar', length: 128, nullable: true })
  stellarTxHash: string;

  /** IDs of medical records shared with the receiving hospital */
  @Column({ name: 'shared_record_ids', type: 'text', array: true, default: [] })
  sharedRecordIds: string[];

  @Column({ name: 'initiated_by', type: 'uuid' })
  initiatedBy: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
