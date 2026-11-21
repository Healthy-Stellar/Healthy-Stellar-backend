import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CorrectionRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('correction_requests')
@Index(['patientId', 'status'])
export class CorrectionRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patientId: string;

  @Column()
  recordId: string;

  @Column()
  recordType: string;

  @Column()
  fieldName: string;

  @Column('text', { nullable: true })
  currentValue: string;

  @Column('text')
  proposedValue: string;

  @Column('text', { nullable: true })
  justification: string;

  @Column({
    type: 'enum',
    enum: CorrectionRequestStatus,
    default: CorrectionRequestStatus.PENDING,
  })
  status: CorrectionRequestStatus;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column('timestamp', { nullable: true })
  reviewedAt: Date;

  @Column('text', { nullable: true })
  reviewNotes: string;

  @Column('jsonb', { default: '[]' })
  auditTrail: Array<{
    action: string;
    actorId: string;
    timestamp: string;
    notes?: string;
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
