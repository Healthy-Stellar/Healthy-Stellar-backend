import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Appointment } from './appointment.entity';

export enum ConsultationOutcome {
  RESOLVED = 'resolved',
  IMPROVED = 'improved',
  STABLE = 'stable',
  WORSENED = 'worsened',
  REQUIRES_FOLLOW_UP = 'requires_follow_up',
  REFERRED = 'referred',
}

@Entity('consultation_notes')
export class ConsultationNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'appointment_id' })
  appointmentId: string;

  @ManyToOne(() => Appointment, (appointment) => appointment.consultationNotes)
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'doctor_id' })
  doctorId: string;

  @Column({ type: 'text' })
  symptoms: string;

  @Column({ type: 'text' })
  diagnosis: string;

  @Column({ type: 'text', nullable: true })
  treatment: string;

  @Column({ type: 'text', nullable: true })
  prescription: string;

  @Column({ type: 'enum', enum: ConsultationOutcome })
  outcome: ConsultationOutcome;

  @Column({ type: 'text', nullable: true })
  recommendations: string;

  @Column({ name: 'follow_up_required', default: false })
  followUpRequired: boolean;

  @Column({ name: 'follow_up_date', nullable: true })
  followUpDate: Date;

  @Column({ name: 'referred_to', nullable: true })
  referredTo: string;

  @Column({ type: 'json', nullable: true })
  vitals: Record<string, any>;

  @Column({ type: 'simple-array', nullable: true })
  attachments: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
