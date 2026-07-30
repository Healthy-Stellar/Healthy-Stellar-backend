import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HospitalRegistry } from '../entities/hospital-registry.entity';
import { CreateHospitalRegistryDto, UpdateHospitalRegistryDto } from '../dto/hospital-registry.dto';

@Injectable()
export class HospitalRegistryService {
  constructor(
    @InjectRepository(HospitalRegistry)
    private readonly repo: Repository<HospitalRegistry>,
  ) {}

  async create(dto: CreateHospitalRegistryDto): Promise<HospitalRegistry> {
    const existing = await this.repo.findOne({ where: { licenseNumber: dto.licenseNumber } });
    if (existing) {
      throw new ConflictException(
        `Hospital with license number ${dto.licenseNumber} already registered`,
      );
    }
    return this.repo.save(this.repo.create(dto));
  }

  async findAll(): Promise<HospitalRegistry[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<HospitalRegistry> {
    const hospital = await this.repo.findOne({ where: { id } });
    if (!hospital) {
      throw new NotFoundException(`Hospital ${id} not found`);
    }
    return hospital;
  }

  async findByLicense(licenseNumber: string): Promise<HospitalRegistry> {
    const hospital = await this.repo.findOne({ where: { licenseNumber } });
    if (!hospital) {
      throw new NotFoundException(`Hospital with license ${licenseNumber} not found`);
    }
    return hospital;
  }

  async update(id: string, dto: UpdateHospitalRegistryDto): Promise<HospitalRegistry> {
    const hospital = await this.findById(id);
    Object.assign(hospital, dto);
    return this.repo.save(hospital);
  }

  async remove(id: string): Promise<void> {
    const hospital = await this.findById(id);
    await this.repo.remove(hospital);
  }
}
