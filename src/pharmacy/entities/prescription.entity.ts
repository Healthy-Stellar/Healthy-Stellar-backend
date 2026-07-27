import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { ControlledSubstanceSchedule } from './drug.entity';
import { PrescriptionItem } from './prescription-item.entity';
import { PrescriptionDispenseRecord } from './prescription-dispense-record.entity';

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  prescriptionNumber: string;

  @Column()
  @Index()
  patientId: string;

  @Column({ nullable: true })
  patientName: string;

  @Column('simple-json', { nullable: true })
  patientAllergies: string[];

  /**
   * Prescribing doctor (medical-staff module). `providerId` is kept for
   * backward compatibility with older callers; `prescriberId` is the field
   * used by the CRUD/dispense flow below and is validated against the
   * medical-staff module's Doctor license status on creation.
   */
  @Column({ nullable: true })
  providerId: string;

  @Column({ nullable: true })
  @Index()
  prescriberId: string;

  @Column()
  drugId: string;

  @Column({ nullable: true })
  drugName: string;

  @Column({ nullable: true })
  dosage: string;

  @Column({ nullable: true })
  quantity: number;

  /** Legacy refill count column; `refillsAllowed` is the field used going forward. */
  @Column({ nullable: true })
  refills: number;

  @Column({ default: 0 })
  refillsAllowed: number;

  @Column({ default: 0 })
  refillsRemaining: number;

  @Column({ nullable: true, type: 'enum', enum: ControlledSubstanceSchedule })
  controlledSubstanceSchedule: ControlledSubstanceSchedule;

  @Column('text', { nullable: true })
  instructions: string;

  /** Legacy "date written" column; `prescriptionDate` is used going forward. */
  @Column('date', { nullable: true })
  prescribedDate: Date;

  @Column('date', { nullable: true })
  prescriptionDate: Date;

  @Column('date', { nullable: true })
  filledDate: Date;

  @Column({ default: 'pending' })
  status: string;

  @Column({ nullable: true })
  pharmacistId: string;

  @Column({ nullable: true })
  verifiedBy: string;

  @Column('timestamp', { nullable: true })
  verifiedAt: Date;

  @Column({ nullable: true })
  dispensedBy: string;

  @Column('timestamp', { nullable: true })
  dispensedAt: Date;

  @Column('simple-json', { nullable: true })
  safetyChecks: any;

  /** Drug-drug interaction check result captured at prescription creation. */
  @Column('simple-json', { nullable: true })
  interactionCheck: any;

  /** Drug-drug interaction check result captured at dispense time. */
  @Column('simple-json', { nullable: true })
  dispenseInteractionCheck: any;

  @Column('text', { nullable: true })
  notes: string;

  @OneToMany(() => PrescriptionItem, (item) => item.prescription)
  items: PrescriptionItem[];

  /** Full dispensing history — one record per dispense transaction. */
  @OneToMany(() => PrescriptionDispenseRecord, (record) => record.prescription)
  dispenseRecords: PrescriptionDispenseRecord[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
