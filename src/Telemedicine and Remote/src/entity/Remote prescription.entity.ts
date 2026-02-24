import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PrescriptionStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SENT_TO_PHARMACY = 'sent_to_pharmacy',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  DENIED = 'denied',
}

export enum MedicationClass {
  CONTROLLED_SUBSTANCE = 'controlled_substance',
  NON_CONTROLLED = 'non_controlled',
  OTC = 'otc',
}

@Entity('remote_prescriptions')
@Index(['patientId', 'createdAt'])
@Index(['virtualVisitId'])
export class RemotePrescription {
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
    enum: PrescriptionStatus,
    default: PrescriptionStatus.DRAFT,
  })
  status: PrescriptionStatus;

  @Column({ type: 'varchar' })
  medicationName: string;

  @Column({ type: 'varchar', nullable: true })
  genericName: string;

  @Column({ type: 'varchar', nullable: true })
  ndcCode: string; // National Drug Code

  @Column({ type: 'varchar' })
  strength: string;

  @Column({ type: 'varchar' })
  dosageForm: string; // tablet, capsule, liquid, etc.

  @Column({ type: 'text' })
  directions: string; // SIG

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'varchar' })
  quantityUnit: string;

  @Column({ type: 'integer', default: 0 })
  refills: number;

  @Column({ type: 'integer', default: 30 })
  daysSupply: number;

  @Column({
    type: 'enum',
    enum: MedicationClass,
  })
  medicationClass: MedicationClass;

  @Column({ type: 'varchar', nullable: true })
  deaSchedule: string; // I, II, III, IV, V for controlled substances

  @Column({ type: 'boolean', default: false })
  isControlledSubstance: boolean;

  @Column({ type: 'varchar', nullable: true })
  prescriptionNumber: string;

  @Column({ type: 'date' })
  prescribedDate: Date;

  @Column({ type: 'date' })
  expirationDate: Date;

  @Column({ type: 'uuid', nullable: true })
  pharmacyId: string;

  @Column({ type: 'varchar', nullable: true })
  pharmacyName: string;

  @Column({ type: 'varchar', nullable: true })
  pharmacyPhone: string;

  @Column({ type: 'text', nullable: true })
  pharmacyAddress: string;

  @Column({ type: 'varchar', nullable: true })
  pharmacyNcpdpId: string;

  @Column({ type: 'boolean', default: false })
  isElectronicPrescription: boolean;

  @Column({ type: 'varchar', nullable: true })
  electronicPrescriptionId: string;

  @Column({ type: 'timestamp', nullable: true })
  sentToPharmacyAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  pharmacyReceivedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  filledAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  diagnosisCodes: {
    code: string;
    description: string;
  }[];

  @Column({ type: 'text', nullable: true })
  clinicalReason: string;

  @Column({ type: 'jsonb', nullable: true })
  allergies: {
    allergen: string;
    reaction: string;
    severity: string;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  drugInteractions: {
    interactingMedication: string;
    severity: 'minor' | 'moderate' | 'major';
    description: string;
  }[];

  @Column({ type: 'boolean', default: false })
  hasInteractionWarning: boolean;

  @Column({ type: 'boolean', default: false })
  overrideInteractionWarning: boolean;

  @Column({ type: 'text', nullable: true })
  overrideReason: string;

  @Column({ type: 'boolean', default: false })
  substituteAllowed: boolean;

  @Column({ type: 'boolean', default: false })
  dispenseAsWritten: boolean;

  @Column({ type: 'varchar', nullable: true })
  providerNpi: string;

  @Column({ type: 'varchar', nullable: true })
  providerDeaNumber: string;

  @Column({ type: 'varchar', nullable: true })
  providerStateLicense: string;

  @Column({ type: 'varchar', nullable: true })
  electronicSignature: string;

  @Column({ type: 'timestamp', nullable: true })
  signedAt: Date;

  @Column({ type: 'text', nullable: true })
  patientInstructions: string;

  @Column({ type: 'text', nullable: true })
  pharmacyNotes: string;

  @Column({ type: 'boolean', default: false })
  isPriorAuthorizationRequired: boolean;

  @Column({ type: 'varchar', nullable: true })
  priorAuthorizationNumber: string;

  @Column({ type: 'boolean', default: false })
  priorAuthorizationObtained: boolean;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string;

  @Column({ type: 'uuid', nullable: true })
  cancelledBy: string;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  auditTrail: {
    action: string;
    performedBy: string;
    timestamp: Date;
    details?: any;
  }[];

  @Column({ type: 'boolean', default: true })
  meetsEpcsRequirements: boolean; // Electronic Prescribing for Controlled Substances

  @Column({ type: 'boolean', default: true })
  hipaaCompliant: boolean;

  @Column({ type: 'jsonb', nullable: true })
  complianceChecks: {
    stateLicenseValid?: boolean;
    deaRegistrationValid?: boolean;
    patientConsentObtained?: boolean;
    appropriateDocumentation?: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;
}
