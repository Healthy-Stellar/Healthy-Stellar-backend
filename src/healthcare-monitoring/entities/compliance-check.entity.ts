import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ComplianceType {
  HIPAA = 'hipaa',
  HITECH = 'hitech',
  FDA = 'fda',
  CMS = 'cms',
  JOINT_COMMISSION = 'joint_commission',
  OSHA = 'osha',
  CDC_GUIDELINES = 'cdc_guidelines',
  STATE_REGULATIONS = 'state_regulations',
  INTERNAL_POLICIES = 'internal_policies',
}

export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PENDING_REVIEW = 'pending_review',
  REMEDIATION_REQUIRED = 'remediation_required',
}

export enum ComplianceSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('compliance_checks')
@Index(['complianceType', 'status'])
@Index(['severity', 'status'])
@Index(['checkDate', 'complianceType'])
export class ComplianceCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ComplianceType,
  })
  complianceType: ComplianceType;

  @Column({ length: 200 })
  checkName: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: ComplianceStatus,
  })
  status: ComplianceStatus;

  @Column({
    type: 'enum',
    enum: ComplianceSeverity,
  })
  severity: ComplianceSeverity;

  @Column({ length: 100, nullable: true })
  department: string;

  @Column({ length: 100, nullable: true })
  system: string;

  @Column('text', { nullable: true })
  findings: string;

  @Column('text', { nullable: true })
  recommendations: string;

  @Column('text', { nullable: true })
  remediationPlan: string;

  @Column({ nullable: true })
  dueDate: Date;

  @Column('uuid', { nullable: true })
  assignedTo: string;

  @Column('uuid', { nullable: true })
  reviewedBy: string;

  @Column({ nullable: true })
  reviewedAt: Date;

  @Column('json', { nullable: true })
  evidence: Record<string, any>;

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @Column()
  checkDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}