import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum BreakGlassStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVIEWED = 'REVIEWED',
  REVOKED = 'REVOKED',
}

@Entity('break_glass_accesses')
@Index(['granteeId', 'status'])
@Index(['patientId', 'status'])
@Index(['status', 'expiresAt'])
@Index(['reviewedBy', 'status'])
export class BreakGlassAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  granteeId: string;

  @Column({ type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ type: 'text' })
  justification: string;

  @Column({ type: 'text', nullable: true })
  clinicalContext: string;

  @Column({
    type: 'enum',
    enum: BreakGlassStatus,
    default: BreakGlassStatus.ACTIVE,
  })
  status: BreakGlassStatus;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  reviewedBy: string;

  @Column({ type: 'text', nullable: true })
  reviewNotes: string;

  @Column({ type: 'text', nullable: true })
  reviewOutcome: string;

  @Column({ type: 'varchar', nullable: true })
  sorobanTxHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
