import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Prescription } from './prescription.entity';

@Entity('patient_counseling_logs')
export class PatientCounselingLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Prescription)
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @Column()
  prescriptionId: string;

  @Column()
  patientId: string;

  @Column()
  patientName: string;

  @Column()
  pharmacistId: string;

  @Column()
  pharmacistName: string;

  @Column()
  pharmacistLicense: string;

  @Column('simple-array')
  counselingTopics: string[]; // medication purpose, dosing, side effects, interactions, etc.

  @Column({ type: 'int' })
  durationMinutes: number;

  @Column('text', { nullable: true })
  counselingNotes: string;

  @Column('text', { nullable: true })
  patientQuestions: string;

  @Column({ default: true })
  patientUnderstood: boolean;

  @Column({ nullable: true })
  patientSignature: string; // Base64 encoded signature

  @Column({ type: 'enum', enum: ['completed', 'refused', 'deferred'] })
  status: string;

  @Column('text', { nullable: true })
  refusalReason: string;

  @CreateDateColumn()
  counselingDate: Date;
}
