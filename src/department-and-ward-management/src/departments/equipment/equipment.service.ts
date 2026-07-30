import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipment } from './entities/equipment.entity';
import { AllocateEquipmentDto } from './dto/allocate-equipment.dto';
import { EquipmentStatus } from '../../common/enums/equipment-status.enum';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(Equipment)
    private equipmentRepository: Repository<Equipment>,
  ) {}

  async allocateEquipment(
    equipmentId: string,
    allocateDto: AllocateEquipmentDto,
  ): Promise<Equipment> {
    const equipment = await this.equipmentRepository.findOne({
      where: { id: equipmentId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${equipmentId} not found`);
    }

    Object.assign(equipment, allocateDto);
    return this.equipmentRepository.save(equipment);
  }

  async getAvailableEquipmentByDepartment(departmentId: string): Promise<Equipment[]> {
    return this.equipmentRepository.find({
      where: {
        departmentId,
        status: EquipmentStatus.AVAILABLE,
      },
    });
  }

  async scheduleMainten(equipmentId: string, maintenanceDate: Date): Promise<Equipment> {
    const equipment = await this.equipmentRepository.findOne({
      where: { id: equipmentId },
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${equipmentId} not found`);
    }

    equipment.nextMaintenanceDate = maintenanceDate;
    equipment.status = EquipmentStatus.MAINTENANCE;

    return this.equipmentRepository.save(equipment);
  }
}
