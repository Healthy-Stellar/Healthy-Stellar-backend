import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AccessRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
  EXPIRED = 'EXPIRED',
}

@Entity('access_requests')
@Index(['patientAddress', 'status'])
@Index(['providerAddress', 'status'])
@Index(['expiresAt', 'status'])
export class AccessRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  providerAddress: string;

  @Column({ type: 'uuid' })
  @Index()
  patientAddress: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: AccessRequestStatus,
    default: AccessRequestStatus.PENDING,
  })
  status: AccessRequestStatus;

  @CreateDateColumn()
  requestedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  /** Soroban tx hash set after approval triggers grant_access on-chain */
  @Column({ type: 'varchar', nullable: true })
  sorobanTxHash: string | null;
}
