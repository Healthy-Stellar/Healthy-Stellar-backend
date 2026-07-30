import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum DocumentType {
  CLINICAL_NOTE = 'clinical_note',
  PRESCRIPTION = 'prescription',
  LAB_ORDER = 'lab_order',
  REFERRAL = 'referral',
  CONSENT_FORM = 'consent_form',
  TREATMENT_PLAN = 'treatment_plan',
  PROGRESS_NOTE = 'progress_note',
  DISCHARGE_SUMMARY = 'discharge_summary',
  OPERATIVE_NOTE = 'operative_note',
  PATIENT_EDUCATION = 'patient_education',
}

export enum DocumentStatus {
  DRAFT = 'draft',
  PENDING_SIGNATURE = 'pending_signature',
  SIGNED = 'signed',
  AMENDED = 'amended',
  DELETED = 'deleted',
}

@Entity('telemedicine_documents')
@Index(['patientId', 'createdAt'])
@Index(['virtualVisitId'])
export class TelemedicineDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ type: 'uuid' })
  providerId: string;

  @Column({ type: 'uuid', nullable: true })
  virtualVisitId: string;

  @Column({
    type: 'enum',
    enum: DocumentType,
  })
  documentType: DocumentType;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.DRAFT,
  })
  status: DocumentStatus;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  content: string;

  // SOAP Note Structure
  @Column({ type: 'jsonb', nullable: true })
  soapNote: {
    subjective?: {
      chiefComplaint?: string;
      historyOfPresentIllness?: string;
      reviewOfSystems?: string;
      pastMedicalHistory?: string;
      medications?: string[];
      allergies?: string[];
      socialHistory?: string;
      familyHistory?: string;
    };
    objective?: {
      vitalSigns?: any;
      physicalExam?: string;
      labResults?: any;
      imagingResults?: any;
    };
    assessment?: {
      diagnosis?: string[];
      differentialDiagnosis?: string[];
      icdCodes?: string[];
    };
    plan?: {
      treatment?: string;
      medications?: any[];
      followUp?: string;
      patientEducation?: string;
      referrals?: string[];
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  diagnoses: {
    code: string;
    description: string;
    type: 'primary' | 'secondary';
  }[];

  @Column({ type: 'jsonb', nullable: true })
  procedures: {
    code: string;
    description: string;
    cptCode?: string;
  }[];

  @Column({ type: 'boolean', default: false })
  isSigned: boolean;

  @Column({ type: 'varchar', nullable: true })
  electronicSignature: string;

  @Column({ type: 'timestamp', nullable: true })
  signedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  signedBy: string;

  @Column({ type: 'boolean', default: false })
  isAmended: boolean;

  @Column({ type: 'text', nullable: true })
  amendmentReason: string;

  @Column({ type: 'uuid', nullable: true })
  amendedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  amendedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  originalDocumentId: string;

  @Column({ type: 'varchar', nullable: true })
  templateId: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: {
    id: string;
    filename: string;
    fileType: string;
    fileSize: number;
    url: string;
    uploadedAt: Date;
  }[];

  @Column({ type: 'boolean', default: true })
  meetsHipaaStandards: boolean;

  @Column({ type: 'boolean', default: true })
  meetsClinicalStandards: boolean;

  @Column({ type: 'jsonb', nullable: true })
  qualityMetrics: {
    completeness?: number; // 0-100%
    timeliness?: boolean;
    accuracy?: number;
    complianceScore?: number;
  };

  @Column({ type: 'text', nullable: true })
  patientInstructions: string;

  @Column({ type: 'boolean', default: false })
  sharedWithPatient: boolean;

  @Column({ type: 'timestamp', nullable: true })
  sharedAt: Date;

  @Column({ type: 'boolean', default: false })
  patientViewed: boolean;

  @Column({ type: 'timestamp', nullable: true })
  patientViewedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  auditTrail: {
    action: string;
    performedBy: string;
    timestamp: Date;
    changes?: any;
  }[];

  @Column({ type: 'boolean', default: true })
  isBillable: boolean;

  @Column({ type: 'uuid', nullable: true })
  billingId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;
}
