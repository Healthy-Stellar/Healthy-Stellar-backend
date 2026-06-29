import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  Unique,
} from 'typeorm';
import { ConsultationNote } from './consultation-note.entity';

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  RESCHEDULED = 'rescheduled',
}

export enum AppointmentType {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
  FOLLOW_UP = 'follow_up',
  TELEMEDICINE = 'telemedicine',
}

export enum MedicalPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
  EMERGENCY = 5,
}

@Entity('appointments')
@Unique('UQ_appointments_doctor_time', ['doctorId', 'startTime', 'endTime'])
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'doctor_id' })
  doctorId: string;

  @Column({ name: 'appointment_date', type: 'timestamp' })
  appointmentDate: Date;

  @Column({ name: 'start_time', type: 'timestamp', nullable: true })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date;

  @Column()
  duration: number; // in minutes

  @Column({ type: 'enum', enum: AppointmentType })
  type: AppointmentType;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.SCHEDULED })
  status: AppointmentStatus;

  @Column({ type: 'enum', enum: MedicalPriority, default: MedicalPriority.NORMAL })
  priority: MedicalPriority;

  @Column({ nullable: true })
  specialty: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'is_telemedicine', default: false })
  isTelemedicine: boolean;

  /** Cryptographically random room identifier – never exposed in list endpoints. */
  @Column({ name: 'telemedicine_room_id', nullable: true, select: false })
  telemedicineRoomId: string;

  /** Kept for backwards-compat; populated with the secure room URL on create. */
  @Column({ name: 'telemedicine_link', nullable: true, select: false })
  telemedicineLink: string;

  @Column({ name: 'reminder_sent', default: false })
  reminderSent: boolean;

  @Column({ name: 'reminder_sent_at', nullable: true })
  reminderSentAt: Date;

  @OneToMany(() => ConsultationNote, (note: ConsultationNote) => note.appointment)
  consultationNotes: ConsultationNote[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
