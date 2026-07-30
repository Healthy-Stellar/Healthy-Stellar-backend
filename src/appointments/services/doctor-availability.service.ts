import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import {
  DoctorAvailability,
  DayOfWeek,
  AvailabilityStatus,
} from '../entities/doctor-availability.entity';
import { TenantContext } from '../../tenant/context/tenant.context';

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

  /**
   * Generates a TypeORM where object that enforces tenant isolation.
   * @private
   */
  private getScopedWhere(baseWhere: FindOptionsWhere<DoctorAvailability> = {}): FindOptionsWhere<DoctorAvailability> {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Tenant context missing');
    }

    return {
      ...baseWhere,
      tenantId,
    };
  }

  async create(createDto: CreateDoctorAvailabilityDto): Promise<DoctorAvailability> {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Tenant context missing');
    }

    const availability = this.availabilityRepository.create({
      ...createDto,
      tenantId,
    });
    return this.availabilityRepository.save(availability);
  }

  async findByDoctor(doctorId: string): Promise<DoctorAvailability[]> {
    return this.availabilityRepository.find({
      where: this.getScopedWhere({ doctorId, isActive: true }),
      order: { dayOfWeek: 'ASC' },
    });
  }

  async updateStatus(id: string, status: AvailabilityStatus): Promise<DoctorAvailability> {
    const availability = await this.availabilityRepository.findOne({ 
      where: this.getScopedWhere({ id }) 
    });
    if (!availability) {
      throw new NotFoundException(`Availability with ID ${id} not found`);
    }

    availability.status = status;
    return this.availabilityRepository.save(availability);
  }
}
