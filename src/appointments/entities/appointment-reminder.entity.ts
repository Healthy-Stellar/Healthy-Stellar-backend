import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ReminderType {
  SMS = 'sms',
  EMAIL = 'email',
  PUSH_NOTIFICATION = 'push_notification',
  PHONE_CALL = 'phone_call',
}

export enum ReminderStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('appointment_reminders')
export class AppointmentReminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'appointment_id' })
  appointmentId: string;

  @Column({ type: 'enum', enum: ReminderType })
  type: ReminderType;

  @Column({ name: 'scheduled_time' })
  scheduledTime: Date;

  @Column({ type: 'enum', enum: ReminderStatus, default: ReminderStatus.PENDING })
  status: ReminderStatus;

  @Column({ type: 'text' })
  message: string;

  @Column({ nullable: true })
  recipient: string;

  @Column({ name: 'sent_at', nullable: true })
  sentAt: Date;

  @Column({ name: 'delivery_status', nullable: true })
  deliveryStatus: string;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
