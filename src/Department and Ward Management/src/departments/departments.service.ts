import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private departmentsRepository: Repository<Department>,
  ) {}

  async create(createDepartmentDto: CreateDepartmentDto): Promise<Department> {
    const department = this.departmentsRepository.create(createDepartmentDto);
    return this.departmentsRepository.save(department);
  }

  async findAll(): Promise<Department[]> {
    return this.departmentsRepository.find({
      relations: ['wards', 'equipment', 'workflows'],
    });
  }

  async findOne(id: string): Promise<Department> {
    const department = await this.departmentsRepository.findOne({
      where: { id },
      relations: ['wards', 'equipment', 'workflows'],
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    return department;
  }

  async getPerformanceMetrics(id: string): Promise<{
    bedOccupancyRate: number;
    equipmentUtilization: number;
    staffEfficiency: number;
    avgPatientStay: number;
  }> {
    const department = await this.findOne(id);

    // Calculate bed occupancy across all wards
    const totalBeds = await this.departmentsRepository
      .createQueryBuilder('dept')
      .leftJoin('dept.wards', 'ward')
      .leftJoin('ward.rooms', 'room')
      .leftJoin('room.beds', 'bed')
      .where('dept.id = :id', { id })
      .andWhere('bed.isActive = :isActive', { isActive: true })
      .getCount();

    const occupiedBeds = await this.departmentsRepository
      .createQueryBuilder('dept')
      .leftJoin('dept.wards', 'ward')
      .leftJoin('ward.rooms', 'room')
      .leftJoin('room.beds', 'bed')
      .where('dept.id = :id', { id })
      .andWhere('bed.status = :status', { status: 'occupied' })
      .getCount();

    const bedOccupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;

    // Mock calculations for other metrics (integrate with real data)
    return {
      bedOccupancyRate: Math.round(bedOccupancyRate * 100) / 100,
      equipmentUtilization: 75.5, // Mock value
      staffEfficiency: 88.2, // Mock value
      avgPatientStay: 4.5, // Mock value (days)
    };
  }
}
