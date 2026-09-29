import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HospitalRegistry } from '../entities/hospital-registry.entity';
import { CreateHospitalRegistryDto, UpdateHospitalRegistryDto } from '../dto/hospital-registry.dto';
import { AuditLogService } from '../../common/services/audit-log.service';

@Injectable()
export class HospitalRegistryService {
  constructor(
    @InjectRepository(HospitalRegistry)
    private readonly repo: Repository<HospitalRegistry>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateHospitalRegistryDto, actorId = 'system'): Promise<HospitalRegistry> {
    const existing = await this.repo.findOne({ where: { licenseNumber: dto.licenseNumber } });
    if (existing) {
      throw new ConflictException(
        `Hospital with license number ${dto.licenseNumber} already registered`,
      );
    }
    const created = await this.repo.save(this.repo.create(dto));
    await this.auditLogService.create({
      operation: 'hospital_registry.create',
      entityType: 'HospitalRegistry',
      entityId: created.id,
      userId: actorId,
      changes: { hospital: created },
      status: 'success',
    });
    return created;
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

  async update(id: string, dto: UpdateHospitalRegistryDto, actorId = 'system'): Promise<HospitalRegistry> {
    const hospital = await this.findById(id);
    const previous = { ...hospital };
    Object.assign(hospital, dto);
    const updated = await this.repo.save(hospital);
    await this.auditLogService.create({
      operation: 'hospital_registry.update',
      entityType: 'HospitalRegistry',
      entityId: id,
      userId: actorId,
      oldValues: previous,
      newValues: updated,
      status: 'success',
    });
    return updated;
  }

  async remove(id: string, actorId = 'system'): Promise<void> {
    const hospital = await this.findById(id);
    await this.repo.remove(hospital);
    await this.auditLogService.create({
      operation: 'hospital_registry.delete',
      entityType: 'HospitalRegistry',
      entityId: id,
      userId: actorId,
      oldValues: { ...hospital },
      status: 'success',
    });
  }
}
