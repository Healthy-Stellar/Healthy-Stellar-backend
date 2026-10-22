import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Prescription } from './prescription.entity';

/**
 * Records a single dispensing transaction against a prescription. A
 * prescription can be dispensed more than once (e.g. partial fills /
 * refills), so this is a one-to-many "dispensing history" rather than a
 * single column on the prescription itself.
 */
@Entity('prescription_dispense_records')
export class PrescriptionDispenseRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Prescription, (prescription) => prescription.dispenseRecords)
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @Column()
  prescriptionId: string;

  @Column()
  drugId: string;

  @Column({ type: 'int' })
  quantityDispensed: number;

  @Column()
  pharmacistId: string;

  /** Highest interaction severity found by the pre-dispense interaction check. */
  @Column({
    type: 'enum',
    enum: ['none', 'minor', 'moderate', 'major', 'contraindicated'],
    default: 'none',
  })
  interactionSeverity: string;

  /** Full interaction-check payload (warnings, sources, etc.) captured at dispense time. */
  @Column('simple-json', { nullable: true })
  interactionCheck: any;

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  dispensedAt: Date;
}
