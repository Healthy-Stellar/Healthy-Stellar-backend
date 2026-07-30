import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { AdministrationRoute } from './medication-administration-record.entity';

export enum MedicationOrderStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  DISCONTINUED = 'discontinued',
}

/** The prescribing order that scheduled doses (MedicationAdministrationRecord) are generated from. */
@Entity('medication_orders')
@Index(['patientId', 'status'])
export class MedicationOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  @Index()
  patientId: string;

  @Column({ name: 'medication_id', type: 'uuid' })
  medicationId: string;

  @Column({ name: 'medication_name', length: 255 })
  medicationName: string;

  @Column({ name: 'dosage', length: 100 })
  dosage: string;

  @Column({ name: 'route', type: 'enum', enum: AdministrationRoute })
  route: AdministrationRoute;

  @Column({ name: 'frequency', length: 100 })
  frequency: string;

  @Column({ name: 'prescribed_by', type: 'uuid' })
  prescribedBy: string;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({ name: 'status', type: 'enum', enum: MedicationOrderStatus, default: MedicationOrderStatus.ACTIVE })
  @Index()
  status: MedicationOrderStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
