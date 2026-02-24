import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { MedicationAdministrationRecord } from './medication-administration-record.entity';
import { BaseAuditEntity } from '../../common/entities/base-audit.entity';

export enum VerificationType {
  PATIENT_WRISTBAND = 'patient_wristband',
  MEDICATION_BARCODE = 'medication_barcode',
  NURSE_BADGE = 'nurse_badge',
}

export enum VerificationStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  OVERRIDE = 'override',
}

@Entity('barcode_verifications')
@Index(['marId'])
@Index(['verificationType', 'status'])
@Index(['nurseId', 'verificationTime'])
export class BarcodeVerification extends BaseAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MedicationAdministrationRecord)
  @JoinColumn({ name: 'mar_id' })
  medicationAdministrationRecord: MedicationAdministrationRecord;

  @Column({ name: 'mar_id', type: 'uuid' })
  @Index()
  marId: string;

  @Column({
    name: 'verification_type',
    type: 'enum',
    enum: VerificationType,
  })
  @Index()
  verificationType: VerificationType;

  @Column({ name: 'scanned_barcode', length: 255 })
  scannedBarcode: string;

  @Column({ name: 'expected_barcode', length: 255, nullable: true })
  expectedBarcode: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: VerificationStatus,
  })
  @Index()
  status: VerificationStatus;

  @Column({ name: 'verification_time', type: 'timestamp' })
  @Index()
  verificationTime: Date;

  @Column({ name: 'nurse_id', type: 'uuid' })
  @Index()
  nurseId: string;

  @Column({ name: 'nurse_name', length: 255 })
  nurseName: string;

  @Column({ name: 'device_id', length: 100, nullable: true })
  deviceId: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'override_reason', type: 'text', nullable: true })
  overrideReason: string;

  @Column({ name: 'override_authorized_by', type: 'uuid', nullable: true })
  overrideAuthorizedBy: string;

  @Column({ name: 'override_authorization_time', type: 'timestamp', nullable: true })
  overrideAuthorizationTime: Date;

  @Column({ name: 'patient_id_verified', type: 'boolean', default: false })
  patientIdVerified: boolean;

  @Column({ name: 'medication_id_verified', type: 'boolean', default: false })
  medicationIdVerified: boolean;

  @Column({ name: 'dose_verified', type: 'boolean', default: false })
  doseVerified: boolean;

  @Column({ name: 'route_verified', type: 'boolean', default: false })
  routeVerified: boolean;

  @Column({ name: 'time_verified', type: 'boolean', default: false })
  timeVerified: boolean;

  @Column({ name: 'verification_notes', type: 'text', nullable: true })
  verificationNotes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
