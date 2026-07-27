import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmergencyMedicalInfo } from '../entities/emergency-medical-info.entity';
import {
  CreateEmergencyMedicalInfoDto,
  UpdateEmergencyMedicalInfoDto,
} from '../dto/emergency-medical-info.dto';

@Injectable()
export class EmergencyMedicalInfoService {
  constructor(
    @InjectRepository(EmergencyMedicalInfo)
    private readonly repo: Repository<EmergencyMedicalInfo>,
  ) {}

  async create(dto: CreateEmergencyMedicalInfoDto): Promise<EmergencyMedicalInfo> {
    const existing = await this.repo.findOne({ where: { patientId: dto.patientId } });
    if (existing) {
      throw new ConflictException(
        `Emergency medical info already exists for patient ${dto.patientId}`,
      );
    }
    return this.repo.save(this.repo.create(dto));
  }

  async findByPatient(patientId: string): Promise<EmergencyMedicalInfo> {
    const record = await this.repo.findOne({ where: { patientId } });
    if (!record) {
      throw new NotFoundException(
        `Emergency medical info not found for patient ${patientId}`,
      );
    }
    return record;
  }

  async findById(id: string): Promise<EmergencyMedicalInfo> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Emergency medical info ${id} not found`);
    }
    return record;
  }

  async update(patientId: string, dto: UpdateEmergencyMedicalInfoDto): Promise<EmergencyMedicalInfo> {
    const record = await this.findByPatient(patientId);
    Object.assign(record, dto);
    return this.repo.save(record);
  }

  async remove(patientId: string): Promise<void> {
    const record = await this.findByPatient(patientId);
    await this.repo.remove(record);
  }
}
