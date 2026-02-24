import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabEquipment, EquipmentStatus } from '../entities/lab-equipment.entity';
import { LabEquipmentInterface, InterfaceStatus } from '../entities/lab-equipment-interface.entity';
import { CreateLabEquipmentDto } from '../dto/create-lab-equipment.dto';

@Injectable()
export class LabEquipmentService {
  constructor(
    @InjectRepository(LabEquipment)
    private equipmentRepository: Repository<LabEquipment>,
    @InjectRepository(LabEquipmentInterface)
    private interfaceRepository: Repository<LabEquipmentInterface>,
  ) {}

  async create(createEquipmentDto: CreateLabEquipmentDto): Promise<LabEquipment> {
    const equipment = this.equipmentRepository.create(createEquipmentDto);
    return this.equipmentRepository.save(equipment);
  }

  async findAll(): Promise<LabEquipment[]> {
    return this.equipmentRepository.find({
      relations: ['interfaces'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<LabEquipment> {
    const equipment = await this.equipmentRepository.findOne({
      where: { id },
      relations: ['interfaces'],
    });

    if (!equipment) {
      throw new NotFoundException(`Equipment with ID ${id} not found`);
    }

    return equipment;
  }

  async updateStatus(id: string, status: EquipmentStatus): Promise<LabEquipment> {
    const equipment = await this.findOne(id);
    equipment.status = status;
    return this.equipmentRepository.save(equipment);
  }

  async scheduleMaintenanceCalibration(
    id: string,
    maintenanceDate?: Date,
    calibrationDate?: Date,
  ): Promise<LabEquipment> {
    const equipment = await this.findOne(id);

    if (maintenanceDate) {
      equipment.nextMaintenanceDate = maintenanceDate;
    }

    if (calibrationDate) {
      equipment.nextCalibrationDate = calibrationDate;
    }

    return this.equipmentRepository.save(equipment);
  }

  async getEquipmentByStatus(status: EquipmentStatus): Promise<LabEquipment[]> {
    return this.equipmentRepository.find({
      where: { status },
      relations: ['interfaces'],
    });
  }

  async getEquipmentDueMaintenance(): Promise<LabEquipment[]> {
    const today = new Date();
    return this.equipmentRepository
      .createQueryBuilder('equipment')
      .where('equipment.nextMaintenanceDate <= :today', { today })
      .orWhere('equipment.nextCalibrationDate <= :today', { today })
      .getMany();
  }

  async testInterface(interfaceId: string): Promise<{ success: boolean; message: string }> {
    const interface_ = await this.interfaceRepository.findOne({
      where: { id: interfaceId },
      relations: ['equipment'],
    });

    if (!interface_) {
      throw new NotFoundException(`Interface with ID ${interfaceId} not found`);
    }

    try {
      // Simulate interface testing logic
      interface_.status = InterfaceStatus.CONNECTED;
      interface_.lastConnectionAt = new Date();
      await this.interfaceRepository.save(interface_);

      return { success: true, message: 'Interface connection successful' };
    } catch (error) {
      interface_.status = InterfaceStatus.ERROR;
      interface_.lastErrorMessage = error.message;
      interface_.errorCount += 1;
      await this.interfaceRepository.save(interface_);

      return { success: false, message: error.message };
    }
  }

  async getInterfaceStatus(): Promise<LabEquipmentInterface[]> {
    return this.interfaceRepository.find({
      relations: ['equipment'],
      order: { lastConnectionAt: 'DESC' },
    });
  }
}
