import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { Drug } from './drug.entity';
import { Prescription } from './prescription.entity';

@Entity('controlled_substance_logs')
export class ControlledSubstanceLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Drug)
  @JoinColumn({ name: 'drug_id' })
  drug: Drug;

  @Column()
  drugId: string;

  @ManyToOne(() => Prescription, { nullable: true })
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @Column({ nullable: true })
  prescriptionId: string;

  @Column({ type: 'enum', enum: ['dispensed', 'received', 'wasted', 'returned', 'transferred', 'stolen'] })
  transactionType: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int' })
  runningBalance: number;

  @Column()
  patientName: string;

  @Column()
  prescriberName: string;

  @Column()
  prescriberDEA: string;

  @Column()
  pharmacistName: string;

  @Column()
  pharmacistLicense: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column({ nullable: true })
  witnessName: string; // for waste/transfers

  @CreateDateColumn()
  transactionDate: Date;
}