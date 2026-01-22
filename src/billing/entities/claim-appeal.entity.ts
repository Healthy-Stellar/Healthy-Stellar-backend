import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { AppealStatus } from '../../common/enums';
import { ClaimDenial } from './claim-denial.entity';

@Entity('claim_appeals')
export class ClaimAppeal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index()
  appealNumber: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  denialId: string;

  @ManyToOne(() => ClaimDenial, (denial) => denial.appeals)
  @JoinColumn({ name: 'denialId' })
  denial: ClaimDenial;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  claimId: string;

  @Column({ type: 'integer', default: 1 })
  appealLevel: number;

  @Column({
    type: 'varchar',
    enum: AppealStatus,
    default: AppealStatus.DRAFT,
  })
  @Index()
  status: AppealStatus;

  @Column({ type: 'date', nullable: true })
  submittedDate: Date;

  @Column({ type: 'date', nullable: true })
  receivedDate: Date;

  @Column({ type: 'date', nullable: true })
  decisionDate: Date;

  @Column({ type: 'date', nullable: true })
  deadline: Date;

  @Column({ type: 'text' })
  appealReason: string;

  @Column({ type: 'text', nullable: true })
  clinicalJustification: string;

  @Column({ type: 'simple-json', nullable: true })
  supportingDocuments: Array<{
    documentId: string;
    documentType: string;
    fileName: string;
    uploadedAt: string;
  }>;

  @Column({ type: 'simple-json', nullable: true })
  additionalCodes: Array<{
    codeType: string;
    code: string;
    description: string;
  }>;

  @Column({ type: 'text', nullable: true })
  payerResponse: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  payerReferenceNumber: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  appealedAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  approvedAmount: number;

  @Column({ type: 'simple-json', nullable: true })
  timeline: Array<{
    date: string;
    action: string;
    notes?: string;
    performedBy?: string;
  }>;

  @Column({ type: 'varchar', length: 100, nullable: true })
  assignedTo: string;

  @Column({ type: 'text', nullable: true })
  internalNotes: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  externalReviewOrganization: string;

  @Column({ type: 'boolean', default: false })
  isExternalReview: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
