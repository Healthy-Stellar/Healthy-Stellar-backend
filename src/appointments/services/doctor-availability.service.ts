import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DoctorAvailability,
  DayOfWeek,
  AvailabilityStatus,
} from '../entities/doctor-availability.entity';

export class CreateDoctorAvailabilityDto {
  doctorId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotDuration?: number;
  maxAppointmentsPerDay?: number;
  specialties?: string[];
  effectiveFrom: Date;
  effectiveTo?: Date;
}

@Injectable()
export class DoctorAvailabilityService {
  constructor(
    @InjectRepository(DoctorAvailability)
    private availabilityRepository: Repository<DoctorAvailability>,
  ) {}

  async create(createDto: CreateDoctorAvailabilityDto): Promise<DoctorAvailability> {
    const availability = this.availabilityRepository.create(createDto);
    return this.availabilityRepository.save(availability);
  }

  async findByDoctor(doctorId: string): Promise<DoctorAvailability[]> {
    return this.availabilityRepository.find({
      where: { doctorId, isActive: true },
      order: { dayOfWeek: 'ASC' },
    });
  }

  async updateStatus(id: string, status: AvailabilityStatus): Promise<DoctorAvailability> {
    const availability = await this.availabilityRepository.findOne({ where: { id } });
    if (!availability) {
      throw new NotFoundException(`Availability with ID ${id} not found`);
    }

    availability.status = status;
    return this.availabilityRepository.save(availability);
  }
}
