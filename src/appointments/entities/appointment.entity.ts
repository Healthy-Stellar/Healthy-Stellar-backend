import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
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

/**
 * Booking conflict prevention on the `appointments` table is enforced at
 * the service layer by `AppointmentService.create()`. It uses
 * transaction-scoped Postgres advisory locks (`pg_advisory_xact_lock`) and
 * buffered range-overlap SELECTs (`SELECT ... FOR UPDATE`) instead of a
 * hard unique constraint, because:
 *
 *   - Conflicts depend on a configurable *buffer time* between
 *     appointments (env `APPOINTMENT_BUFFER_MINUTES`, default 15), not
 *     on exact `(doctor_id, start_time, end_time)` equality.
 *   - A single doctor OR a single physical room booking can conflict,
 *     and either side of that OR works against an exact-time unique
 *     constraint differently than against an overlap query.
 *   - SELECT FOR UPDATE requires us to be able to insert "no-conflict"
 *     appointments whose window is, after buffering, disjoint from any
 *     existing row — which the historical `@Unique` blocked.
 *
 * The historical constraint `UQ_appointments_doctor_time` was dropped in
 * migration `1782900000000-AppointmentBookingConflictPrevention`.
 * Indexes supporting the buffered overlap lookup were added by that
 * same migration (`IDX_appointments_tenant_doctor_room_start_end`,
 * `IDX_appointments_room_id`).
 */
@Entity('appointments')
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

  /**
   * Optional physical room assignment. Conflicts on this column are
   * detected identically to conflicts on `doctorId` by
   * AppointmentService.create(): any other appointment with the same
   * `roomId` whose `[startTime, endTime]` (with the configured buffer
   * expanded on both sides) overlaps the new one will produce a 409.
   *
   * `telemedicine_room_id` is a separate concept — a per-session virtual
   * UUID minted by the service — and is intentionally NOT consulted for
   * booking conflicts, since two telemedicine appointments cannot
   * physically share a real room.
   */
  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  roomId: string | null;

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
