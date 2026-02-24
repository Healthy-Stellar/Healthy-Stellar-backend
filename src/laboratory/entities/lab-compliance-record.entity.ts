import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LabAccreditation } from './lab-accreditation.entity';

export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PARTIALLY_COMPLIANT = 'partially_compliant',
  UNDER_REVIEW = 'under_review',
  CORRECTIVE_ACTION_REQUIRED = 'corrective_action_required',
}

export enum ComplianceType {
  QUALITY_CONTROL = 'quality_control',
  PROFICIENCY_TESTING = 'proficiency_testing',
  EQUIPMENT_MAINTENANCE = 'equipment_maintenance',
  STAFF_TRAINING = 'staff_training',
  DOCUMENTATION = 'documentation',
  SAFETY_PROTOCOLS = 'safety_protocols',
  DATA_INTEGRITY = 'data_integrity',
}

@Entity('lab_compliance_records')
export class LabComplianceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'accreditation_id' })
  accreditationId: string;

  @ManyToOne(() => LabAccreditation, (accreditation) => accreditation.complianceRecords)
  @JoinColumn({ name: 'accreditation_id' })
  accreditation: LabAccreditation;

  @Column({ type: 'enum', enum: ComplianceType })
  type: ComplianceType;

  @Column()
  requirement: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: ComplianceStatus })
  status: ComplianceStatus;

  @Column({ name: 'assessment_date' })
  assessmentDate: Date;

  @Column({ name: 'assessed_by' })
  assessedBy: string;

  @Column({ name: 'due_date', nullable: true })
  dueDate: Date;

  @Column({ name: 'completion_date', nullable: true })
  completionDate: Date;

  @Column({ type: 'text', nullable: true })
  findings: string;

  @Column({ type: 'text', nullable: true })
  corrective_actions: string;

  @Column({ name: 'evidence_file_path', nullable: true })
  evidenceFilePath: string;

  @Column({ name: 'responsible_person', nullable: true })
  responsiblePerson: string;

  @Column({ name: 'follow_up_required', default: false })
  followUpRequired: boolean;

  @Column({ name: 'follow_up_date', nullable: true })
  followUpDate: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
