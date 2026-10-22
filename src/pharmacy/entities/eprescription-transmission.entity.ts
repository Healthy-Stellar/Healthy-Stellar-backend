import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum TransmissionStatus {
  PENDING = 'pending',
  TRANSMITTED = 'transmitted',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

@Entity('eprescription_transmissions')
@Index(['prescriptionId'])
@Index(['status'])
export class EprescriptionTransmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  prescriptionId: string;

  @Column()
  externalPharmacyId: string;

  @Column({ nullable: true })
  pharmacyNcpdpId: string;

  @Column({
    type: 'enum',
    enum: TransmissionStatus,
    default: TransmissionStatus.PENDING,
  })
  status: TransmissionStatus;

  @Column('jsonb', { nullable: true })
  ncpdpNewRxPayload: Record<string, any>;

  @Column('jsonb', { nullable: true })
  transmissionResponse: Record<string, any>;

  @Column({ default: 0 })
  retryCount: number;

  @Column('timestamp', { nullable: true })
  transmittedAt: Date;

  @Column('timestamp', { nullable: true })
  lastRetryAt: Date;

  @Column('text', { nullable: true })
  failureReason: string;

  @Column({ nullable: true })
  transmittedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
