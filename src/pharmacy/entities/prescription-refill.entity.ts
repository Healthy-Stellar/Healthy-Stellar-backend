import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Prescription } from './prescription.entity';

@Entity('prescription_refills')
export class PrescriptionRefill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Prescription)
  @JoinColumn({ name: 'original_prescription_id' })
  originalPrescription: Prescription;

  @Column()
  originalPrescriptionId: string;

  @ManyToOne(() => Prescription)
  @JoinColumn({ name: 'refill_prescription_id' })
  refillPrescription: Prescription;

  @Column()
  refillPrescriptionId: string;

  @Column({ type: 'int' })
  refillNumber: number;

  @Column()
  pharmacistId: string;

  @Column()
  pharmacistName: string;

  @Column({ type: 'date', nullable: true })
  patientRequestDate: Date;

  @Column('text', { nullable: true })
  notes: string;

  @CreateDateColumn()
  refillDate: Date;
}
