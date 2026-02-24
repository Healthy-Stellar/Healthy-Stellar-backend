import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity';

export enum AdministrationStatus {
  SCHEDULED = 'scheduled',
  ADMINISTERED = 'administered',
  MISSED = 'missed',
  REFUSED = 'refused',
  HELD = 'held',
  DISCONTINUED = 'discontinued',
}

export enum AdministrationRoute {
  ORAL = 'oral',
  IV = 'intravenous',
  IM = 'intramuscular',
  SC = 'subcutaneous',
  TOPICAL = 'topical',
  INHALATION = 'inhalation',
  RECTAL = 'rectal',
  SUBLINGUAL = 'sublingual',
  TRANSDERMAL = 'transdermal',
}

@Entity('medication_administration_records')
@Index(['patientId', 'scheduledTime'])
@Index(['nurseId', 'administrationDate'])
@Index(['medicationId', 'status'])
export class MedicationAdministrationRecord extends BaseAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ name: 'prescription_id', type: 'uuid' })
  prescriptionId: string;

  @Column({ name: 'medication_id', type: 'uuid' })
  medicationId: string;

  @Column({ name: 'medication_name', length: 255 })
  medicationName: string;

  @Column({ name: 'medication_barcode', length: 100, nullable: true })
  medicationBarcode: string;

  @Column({ name: 'dosage', length: 100 })
  dosage: string;

  @Column({
    name: 'route',
    type: 'enum',
    enum: AdministrationRoute,
  })
  route: AdministrationRoute;

  @Column({ name: 'scheduled_time', type: 'timestamp' })
  @Index()
  scheduledTime: Date;

  @Column({ name: 'administration_time', type: 'timestamp', nullable: true })
  administrationTime: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AdministrationStatus,
    default: AdministrationStatus.SCHEDULED,
  })
  @Index()
  status: AdministrationStatus;

  @Column({ name: 'nurse_id', type: 'uuid', nullable: true })
  @Index()
  nurseId: string;

  @Column({ name: 'nurse_name', length: 255, nullable: true })
  nurseName: string;

  @Column({ name: 'witness_id', type: 'uuid', nullable: true })
  witnessId: string;

  @Column({ name: 'witness_name', length: 255, nullable: true })
  witnessName: string;

  @Column({ name: 'barcode_verified', type: 'boolean', default: false })
  barcodeVerified: boolean;

  @Column({ name: 'patient_verified', type: 'boolean', default: false })
  patientVerified: boolean;

  @Column({ name: 'medication_verified', type: 'boolean', default: false })
  medicationVerified: boolean;

  @Column({ name: 'dose_verified', type: 'boolean', default: false })
  doseVerified: boolean;

  @Column({ name: 'route_verified', type: 'boolean', default: false })
  routeVerified: boolean;

  @Column({ name: 'time_verified', type: 'boolean', default: false })
  timeVerified: boolean;

  @Column({ name: 'administration_notes', type: 'text', nullable: true })
  administrationNotes: string;

  @Column({ name: 'refusal_reason', type: 'text', nullable: true })
  refusalReason: string;

  @Column({ name: 'hold_reason', type: 'text', nullable: true })
  holdReason: string;

  @Column({ name: 'site_of_administration', length: 255, nullable: true })
  siteOfAdministration: string;

  @Column({ name: 'lot_number', length: 100, nullable: true })
  lotNumber: string;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate: Date;

  @Column({ name: 'is_prn', type: 'boolean', default: false })
  isPrn: boolean;

  @Column({ name: 'prn_reason', type: 'text', nullable: true })
  prnReason: string;

  @Column({ name: 'is_high_alert', type: 'boolean', default: false })
  isHighAlert: boolean;

  @Column({ name: 'requires_witness', type: 'boolean', default: false })
  requiresWitness: boolean;

  @Column({ name: 'administration_date', type: 'date' })
  @Index()
  administrationDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
