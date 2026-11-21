import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmergencyMedicalInfo } from '../entities/emergency-medical-info.entity';
import { EmergencyMedicalInfoHistory } from '../entities/emergency-medical-info-history.entity';
import {
  CreateEmergencyMedicalInfoDto,
  UpdateEmergencyMedicalInfoDto,
} from '../dto/emergency-medical-info.dto';

@Injectable()
export class EmergencyMedicalInfoService {
  constructor(
    @InjectRepository(EmergencyMedicalInfo)
    private readonly repo: Repository<EmergencyMedicalInfo>,
    @InjectRepository(EmergencyMedicalInfoHistory)
    private readonly historyRepo: Repository<EmergencyMedicalInfoHistory>,
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

  async update(patientId: string, dto: UpdateEmergencyMedicalInfoDto, performedBy: string): Promise<EmergencyMedicalInfo> {
    const record = await this.findByPatient(patientId);
    
    // Store previous values for audit
    const previousValues = { ...record };
    
    Object.assign(record, dto);
    const updated = await this.repo.save(record);
    
    // Create history entry
    await this.historyRepo.save(this.historyRepo.create({
      emergencyMedicalInfoId: updated.id,
      patientId: updated.patientId,
      previousValues: previousValues,
      newValues: dto,
      performedBy: performedBy,
    }));

    return updated;
  }

  async getHistory(patientId: string): Promise<EmergencyMedicalInfoHistory[]> {
    return this.historyRepo.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async getLastUpdater(emergencyMedicalInfoId: string): Promise<string | null> {
    const lastHistory = await this.historyRepo.findOne({
      where: { emergencyMedicalInfoId },
      order: { createdAt: 'DESC' },
    });
    return lastHistory?.performedBy ?? null;
  }

  async remove(patientId: string): Promise<void> {
    const record = await this.findByPatient(patientId);
    await this.repo.remove(record);
  }
}
