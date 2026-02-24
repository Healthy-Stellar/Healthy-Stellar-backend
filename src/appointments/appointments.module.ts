import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Appointment } from './entities/appointment.entity';
import { DoctorAvailability } from './entities/doctor-availability.entity';
import { ConsultationNote } from './entities/consultation-note.entity';
import { AppointmentReminder } from './entities/appointment-reminder.entity';

// Services
import { AppointmentService } from './services/appointment.service';
import { ConsultationService } from './services/consultation.service';
import { ReminderService } from './services/reminder.service';
import { DoctorAvailabilityService } from './services/doctor-availability.service';

// Controllers
import { AppointmentController } from './controllers/appointment.controller';
import { ConsultationController } from './controllers/consultation.controller';
import { DoctorAvailabilityController } from './controllers/doctor-availability.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      DoctorAvailability,
      ConsultationNote,
      AppointmentReminder,
    ]),
  ],
  controllers: [AppointmentController, ConsultationController, DoctorAvailabilityController],
  providers: [AppointmentService, ConsultationService, ReminderService, DoctorAvailabilityService],
  exports: [AppointmentService, ConsultationService, ReminderService, DoctorAvailabilityService],
})
export class AppointmentsModule {}
