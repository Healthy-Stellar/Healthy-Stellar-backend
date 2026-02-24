import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  AppointmentReminder,
  ReminderType,
  ReminderStatus,
} from '../entities/appointment-reminder.entity';
import { Appointment } from '../entities/appointment.entity';

@Injectable()
export class ReminderService {
  constructor(
    @InjectRepository(AppointmentReminder)
    private reminderRepository: Repository<AppointmentReminder>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
  ) {}

  async scheduleReminder(
    appointmentId: string,
    type: ReminderType,
    hoursBeforeAppointment: number = 24,
  ): Promise<AppointmentReminder> {
    const appointment = await this.appointmentRepository.findOne({ where: { id: appointmentId } });
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    const scheduledTime = new Date(
      appointment.appointmentDate.getTime() - hoursBeforeAppointment * 60 * 60 * 1000,
    );

    const message = this.generateReminderMessage(appointment, type);

    const reminder = this.reminderRepository.create({
      appointmentId,
      type,
      scheduledTime,
      message,
      recipient: appointment.patientId, // In real implementation, get patient contact info
    });

    return this.reminderRepository.save(reminder);
  }

  async getPendingReminders(): Promise<AppointmentReminder[]> {
    return this.reminderRepository.find({
      where: {
        status: ReminderStatus.PENDING,
        scheduledTime: LessThan(new Date()),
      },
      order: { scheduledTime: 'ASC' },
    });
  }

  async markAsSent(reminderId: string): Promise<AppointmentReminder> {
    const reminder = await this.reminderRepository.findOne({ where: { id: reminderId } });
    if (!reminder) {
      throw new Error('Reminder not found');
    }

    reminder.status = ReminderStatus.SENT;
    reminder.sentAt = new Date();

    return this.reminderRepository.save(reminder);
  }

  async markAsFailed(reminderId: string, errorMessage: string): Promise<AppointmentReminder> {
    const reminder = await this.reminderRepository.findOne({ where: { id: reminderId } });
    if (!reminder) {
      throw new Error('Reminder not found');
    }

    reminder.status = ReminderStatus.FAILED;
    reminder.errorMessage = errorMessage;
    reminder.retryCount += 1;

    return this.reminderRepository.save(reminder);
  }

  async processReminders(): Promise<void> {
    const pendingReminders = await this.getPendingReminders();

    for (const reminder of pendingReminders) {
      try {
        await this.sendReminder(reminder);
        await this.markAsSent(reminder.id);
      } catch (error) {
        await this.markAsFailed(reminder.id, error.message);
      }
    }
  }

  private async sendReminder(reminder: AppointmentReminder): Promise<void> {
    // Simulate sending reminder based on type
    switch (reminder.type) {
      case ReminderType.EMAIL:
        console.log(`Sending email reminder to ${reminder.recipient}: ${reminder.message}`);
        break;
      case ReminderType.SMS:
        console.log(`Sending SMS reminder to ${reminder.recipient}: ${reminder.message}`);
        break;
      case ReminderType.PUSH_NOTIFICATION:
        console.log(`Sending push notification to ${reminder.recipient}: ${reminder.message}`);
        break;
      case ReminderType.PHONE_CALL:
        console.log(`Making phone call to ${reminder.recipient}: ${reminder.message}`);
        break;
    }
  }

  private generateReminderMessage(appointment: Appointment, type: ReminderType): string {
    const date = appointment.appointmentDate.toLocaleDateString();
    const time = appointment.appointmentDate.toLocaleTimeString();

    return `Reminder: You have an appointment scheduled for ${date} at ${time}. ${appointment.isTelemedicine ? 'This is a telemedicine appointment.' : 'Please arrive 15 minutes early.'}`;
  }
}
