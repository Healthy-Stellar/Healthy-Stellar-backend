import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum WaitlistStatus {
  WAITING = 'waiting',
  NOTIFIED = 'notified',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('appointment_waitlist')
@Index(['doctorId', 'status'])
export class AppointmentWaitlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  patientId: string;

  @Column()
  doctorId: string;

  @Column({ name: 'preferred_date_start', type: 'timestamp' })
  preferredDateStart: Date;

  @Column({ name: 'preferred_date_end', type: 'timestamp' })
  preferredDateEnd: Date;

  @Column({ type: 'varchar', default: WaitlistStatus.WAITING })
  status: WaitlistStatus;

  /** Freed appointment slot offered to this patient. */
  @Column({ name: 'offered_appointment_id', nullable: true })
  offeredAppointmentId: string | null;

  /** When the offer was sent; used to compute the response deadline. */
  @Column({ name: 'notified_at', type: 'timestamp', nullable: true })
  notifiedAt: Date | null;

  /** Minutes the patient has to accept before the slot is offered to the next person. */
  @Column({ name: 'response_window_minutes', default: 30 })
  responseWindowMinutes: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
