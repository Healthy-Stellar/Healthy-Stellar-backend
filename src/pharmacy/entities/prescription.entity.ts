import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { Drug } from './drug.entity';
import { PrescriptionItem } from './prescription-item.entity';

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  prescriptionNumber: string;

  @Column()
  patientId: string;

  @Column()
  patientName: string;

  @Column({ type: 'date' })
  patientDOB: Date;

  @Column('simple-array', { nullable: true })
  patientAllergies: string[];

  @Column()
  prescriberId: string;

  @Column()
  prescriberName: string;

  @Column()
  prescriberLicense: string;

  @Column()
  prescriberDEA: string; // DEA number for controlled substances

  @Column({ type: 'date' })
  prescriptionDate: Date;

  @Column({ type: 'enum', enum: ['pending', 'verified', 'filling', 'filled', 'dispensed', 'cancelled'] })
  status: string;

  @Column({ type: 'int', default: 0 })
  refillsAllowed: number;

  @Column({ type: 'int', default: 0 })
  refillsRemaining: number;

  @Column('text', { nullable: true })
  notes: string;

  @Column({ default: false })
  requiresCounseling: boolean;

  @Column({ nullable: true })
  verifiedBy: string; // pharmacist who verified

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date;

  @Column({ nullable: true })
  dispensedBy: string; // pharmacist who dispensed

  @Column({ type: 'timestamp', nullable: true })
  dispensedAt: Date;

  @OneToMany(() => PrescriptionItem, item => item.prescription)
  items: PrescriptionItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}