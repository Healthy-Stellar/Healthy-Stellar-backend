import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { LabComplianceRecord } from './lab-compliance-record.entity';

export enum AccreditationStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
  PENDING_RENEWAL = 'pending_renewal',
  UNDER_REVIEW = 'under_review',
}

export enum AccreditationType {
  CAP = 'cap', // College of American Pathologists
  CLIA = 'clia', // Clinical Laboratory Improvement Amendments
  ISO_15189 = 'iso_15189',
  NABL = 'nabl', // National Accreditation Board for Testing and Calibration Laboratories
  JCI = 'jci', // Joint Commission International
  LOCAL_HEALTH_AUTHORITY = 'local_health_authority',
}

@Entity('lab_accreditations')
export class LabAccreditation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AccreditationType })
  type: AccreditationType;

  @Column({ name: 'accreditation_body' })
  accreditationBody: string;

  @Column({ name: 'certificate_number', unique: true })
  certificateNumber: string;

  @Column({ type: 'enum', enum: AccreditationStatus })
  status: AccreditationStatus;

  @Column({ name: 'issued_date' })
  issuedDate: Date;

  @Column({ name: 'expiry_date' })
  expiryDate: Date;

  @Column({ name: 'renewal_date', nullable: true })
  renewalDate: Date;

  @Column({ name: 'scope_of_accreditation', type: 'text' })
  scopeOfAccreditation: string;

  @Column({ name: 'certificate_file_path', nullable: true })
  certificateFilePath: string;

  @Column({ name: 'next_assessment_date', nullable: true })
  nextAssessmentDate: Date;

  @Column({ name: 'assessment_frequency', nullable: true })
  assessmentFrequency: number; // in months

  @OneToMany(() => LabComplianceRecord, (record) => record.accreditation)
  complianceRecords: LabComplianceRecord[];

  @Column({ type: 'json', nullable: true })
  requirements: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
