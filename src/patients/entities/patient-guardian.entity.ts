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
import { Patient } from './patient.entity';

export enum GuardianRelationshipType {
  PARENT = 'parent',
  LEGAL_GUARDIAN = 'legal_guardian',
  SPOUSE = 'spouse',
  SIBLING = 'sibling',
  OTHER = 'other',
}

export enum GuardianshipStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
  PENDING_REVIEW = 'pending_review',
}

@Entity('patient_guardians')
@Index(['guardianUserId', 'dependentPatientId'], { unique: true })
@Index(['dependentPatientId', 'status'])
export class PatientGuardian {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The user (guardian) who has authority over the dependent */
  @Column({ type: 'uuid' })
  @Index()
  guardianUserId: string;

  /** The patient record being managed */
  @Column({ type: 'uuid' })
  @Index()
  dependentPatientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dependentPatientId' })
  dependentPatient: Patient;

  @Column({
    type: 'enum',
    enum: GuardianRelationshipType,
  })
  relationshipType: GuardianRelationshipType;

  @Column({
    type: 'enum',
    enum: GuardianshipStatus,
    default: GuardianshipStatus.ACTIVE,
  })
  status: GuardianshipStatus;

  @Column({ type: 'date' })
  effectiveFrom: string;

  @Column({ type: 'date', nullable: true })
  effectiveTo: string | null;

  /** Set when guardianship is revoked */
  @Column({ type: 'uuid', nullable: true })
  revokedBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  revocationReason: string | null;

  /** Tracks who created this link */
  @Column({ type: 'uuid' })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
