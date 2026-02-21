import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AccessLevel {
  READ = 'READ',
  READ_WRITE = 'READ_WRITE',
}

export enum GrantStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

@Entity('access_grants')
@Index(['patientId', 'granteeId', 'status'])
@Index(['granteeId', 'status'])
export class AccessGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ type: 'uuid' })
  @Index()
  granteeId: string;

  @Column({ type: 'simple-array' })
  recordIds: string[];

  @Column({
    type: 'enum',
    enum: AccessLevel,
  })
  accessLevel: AccessLevel;

  @Column({
    type: 'enum',
    enum: GrantStatus,
    default: GrantStatus.ACTIVE,
  })
  status: GrantStatus;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  revokedBy: string;

  @Column({ type: 'text', nullable: true })
  revocationReason: string;

  @Column({ type: 'varchar', nullable: true })
  sorobanTxHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
