import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Not } from 'typeorm';
import { Appointment, AppointmentStatus, MedicalPriority } from '../entities/appointment.entity';
import { DoctorAvailability } from '../entities/doctor-availability.entity';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(DoctorAvailability)
    private availabilityRepository: Repository<DoctorAvailability>,
  ) {}

  async create(createAppointmentDto: CreateAppointmentDto): Promise<Appointment> {
    const appointmentDate = new Date(createAppointmentDto.appointmentDate);

    // Check doctor availability
    const isAvailable = await this.checkDoctorAvailability(
      createAppointmentDto.doctorId,
      appointmentDate,
      createAppointmentDto.duration,
    );

    if (!isAvailable) {
      throw new BadRequestException('Doctor is not available at the requested time');
    }

    // Check specialty match if specified
    if (createAppointmentDto.specialty) {
      const hasSpecialty = await this.checkDoctorSpecialty(
        createAppointmentDto.doctorId,
        createAppointmentDto.specialty,
      );
      if (!hasSpecialty) {
        throw new BadRequestException('Doctor does not have the required specialty');
      }
    }

    const appointment = this.appointmentRepository.create({
      ...createAppointmentDto,
      appointmentDate,
      telemedicineLink: createAppointmentDto.isTelemedicine
        ? `https://telemedicine.app/room/${Date.now()}`
        : null,
    });

    return this.appointmentRepository.save(appointment);
  }

  async findAll(): Promise<Appointment[]> {
    return this.appointmentRepository.find({
      relations: ['consultationNotes'],
      order: { appointmentDate: 'ASC' },
    });
  }

  async findByPriority(priority: MedicalPriority): Promise<Appointment[]> {
    return this.appointmentRepository.find({
      where: { priority },
      relations: ['consultationNotes'],
      order: { appointmentDate: 'ASC' },
    });
  }

  async findByDoctor(doctorId: string, date?: Date): Promise<Appointment[]> {
    const whereCondition: any = { doctorId };

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      whereCondition.appointmentDate = Between(startOfDay, endOfDay);
    }

    return this.appointmentRepository.find({
      where: whereCondition,
      relations: ['consultationNotes'],
      order: { appointmentDate: 'ASC' },
    });
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({ where: { id } });
    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    appointment.status = status;
    return this.appointmentRepository.save(appointment);
  }

  async getAvailableSlots(doctorId: string, date: Date): Promise<string[]> {
    const dayOfWeek = date.getDay() || 7; // Convert Sunday (0) to 7

    const availability = await this.availabilityRepository.findOne({
      where: {
        doctorId,
        dayOfWeek,
        isActive: true,
      },
    });

    if (!availability) {
      return [];
    }

    // Get existing appointments for the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await this.appointmentRepository.find({
      where: {
        doctorId,
        appointmentDate: Between(startOfDay, endOfDay),
        status: Not(AppointmentStatus.CANCELLED),
      },
    });

    return this.calculateAvailableSlots(availability, existingAppointments, date);
  }

  private async checkDoctorAvailability(
    doctorId: string,
    appointmentDate: Date,
    duration: number,
  ): Promise<boolean> {
    const dayOfWeek = appointmentDate.getDay() || 7;

    const availability = await this.availabilityRepository.findOne({
      where: {
        doctorId,
        dayOfWeek,
        isActive: true,
      },
    });

    if (!availability) return false;

    // Check if appointment time falls within availability hours
    const appointmentTime = appointmentDate.getHours() * 60 + appointmentDate.getMinutes();
    const [startHour, startMin] = availability.startTime.split(':').map(Number);
    const [endHour, endMin] = availability.endTime.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (appointmentTime < startTime || appointmentTime + duration > endTime) {
      return false;
    }

    // Check for conflicts with existing appointments
    const startOfSlot = new Date(appointmentDate);
    const endOfSlot = new Date(appointmentDate.getTime() + duration * 60000);

    const conflictingAppointments = await this.appointmentRepository.count({
      where: {
        doctorId,
        appointmentDate: Between(startOfSlot, endOfSlot),
        status: Not(AppointmentStatus.CANCELLED),
      },
    });

    return conflictingAppointments === 0;
  }

  private async checkDoctorSpecialty(doctorId: string, specialty: string): Promise<boolean> {
    const availability = await this.availabilityRepository.findOne({
      where: { doctorId, isActive: true },
    });

    return availability?.specialties?.includes(specialty) || false;
  }

  private calculateAvailableSlots(
    availability: DoctorAvailability,
    existingAppointments: Appointment[],
    date: Date,
  ): string[] {
    const slots: string[] = [];
    const [startHour, startMin] = availability.startTime.split(':').map(Number);
    const [endHour, endMin] = availability.endTime.split(':').map(Number);

    let currentTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    while (currentTime + availability.slotDuration <= endTime) {
      const slotStart = new Date(date);
      slotStart.setHours(Math.floor(currentTime / 60), currentTime % 60, 0, 0);

      const slotEnd = new Date(slotStart.getTime() + availability.slotDuration * 60000);

      const hasConflict = existingAppointments.some((apt) => {
        const aptStart = new Date(apt.appointmentDate);
        const aptEnd = new Date(aptStart.getTime() + apt.duration * 60000);
        return slotStart < aptEnd && slotEnd > aptStart;
      });

      if (!hasConflict) {
        slots.push(
          `${String(Math.floor(currentTime / 60)).padStart(2, '0')}:${String(currentTime % 60).padStart(2, '0')}`,
        );
      }

      currentTime += availability.slotDuration;
    }

    return slots;
  }
}
