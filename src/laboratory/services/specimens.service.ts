import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Specimen, SpecimenStatus } from '../entities/specimen.entity';
import { LabOrder } from '../entities/lab-order.entity';
import { CreateSpecimenDto } from '../dto/create-specimen.dto';

@Injectable()
export class SpecimensService {
  private readonly logger = new Logger(SpecimensService.name);

  constructor(
    @InjectRepository(Specimen)
    private specimenRepository: Repository<Specimen>,
    @InjectRepository(LabOrder)
    private labOrderRepository: Repository<LabOrder>,
  ) {}

  async create(createDto: CreateSpecimenDto, userId: string): Promise<Specimen> {
    this.logger.log(`Creating specimen: ${createDto.specimenId}`);

    // Check if specimen ID already exists
    const existing = await this.specimenRepository.findOne({
      where: { specimenId: createDto.specimenId },
    });

    if (existing) {
      throw new ConflictException(`Specimen with ID ${createDto.specimenId} already exists`);
    }

    // Verify lab order exists
    const labOrder = await this.labOrderRepository.findOne({
      where: { id: createDto.labOrderId },
    });

    if (!labOrder) {
      throw new NotFoundException(`Lab order with ID ${createDto.labOrderId} not found`);
    }

    const specimen = this.specimenRepository.create({
      ...createDto,
      collectionDate: createDto.collectionDate ? new Date(createDto.collectionDate) : new Date(),
      chainOfCustody: [
        {
          timestamp: new Date(),
          action: 'COLLECTED',
          userId: userId,
          userName: createDto.collectedByName,
          location: createDto.collectionLocation,
          notes: 'Initial collection',
        },
      ],
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.specimenRepository.save(specimen);
    this.logger.log(`Specimen created: ${saved.id}`);

    return this.findOne(saved.id);
  }

  async findOne(id: string): Promise<Specimen> {
    const specimen = await this.specimenRepository.findOne({
      where: { id },
      relations: ['labOrder', 'labOrder.items', 'labOrder.items.labTest'],
    });

    if (!specimen) {
      throw new NotFoundException(`Specimen with ID ${id} not found`);
    }

    return specimen;
  }

  async findBySpecimenId(specimenId: string): Promise<Specimen> {
    const specimen = await this.specimenRepository.findOne({
      where: { specimenId },
      relations: ['labOrder', 'labOrder.items', 'labOrder.items.labTest'],
    });

    if (!specimen) {
      throw new NotFoundException(`Specimen with specimen ID ${specimenId} not found`);
    }

    return specimen;
  }

  async findByOrder(orderId: string): Promise<Specimen[]> {
    return this.specimenRepository.find({
      where: { labOrderId: orderId },
      order: { collectionDate: 'DESC' },
    });
  }

  async updateStatus(
    id: string,
    status: SpecimenStatus,
    userId: string,
    userName?: string,
    location?: string,
    notes?: string,
  ): Promise<Specimen> {
    const specimen = await this.findOne(id);

    // Validate status transition
    this.validateStatusTransition(specimen.status, status);

    specimen.status = status;
    specimen.updatedBy = userId;

    // Update specific fields based on status
    if (status === SpecimenStatus.RECEIVED) {
      specimen.receivedDate = new Date();
      specimen.receivedBy = userId;
      specimen.receivedByName = userName;
    }

    // Add to chain of custody
    const custodyEntry = {
      timestamp: new Date(),
      action: status.toUpperCase(),
      userId: userId,
      userName: userName,
      location: location,
      notes: notes,
    };

    specimen.chainOfCustody = [...(specimen.chainOfCustody || []), custodyEntry];

    const saved = await this.specimenRepository.save(specimen);
    this.logger.log(`Specimen status updated: ${saved.id} -> ${status}`);

    return this.findOne(saved.id);
  }

  async reject(id: string, reason: string, userId: string, userName?: string): Promise<Specimen> {
    const specimen = await this.findOne(id);

    specimen.status = SpecimenStatus.REJECTED;
    specimen.rejectionReason = reason;
    specimen.updatedBy = userId;

    // Add to chain of custody
    const custodyEntry = {
      timestamp: new Date(),
      action: 'REJECTED',
      userId: userId,
      userName: userName,
      notes: `Rejected: ${reason}`,
    };

    specimen.chainOfCustody = [...(specimen.chainOfCustody || []), custodyEntry];

    const saved = await this.specimenRepository.save(specimen);
    this.logger.log(`Specimen rejected: ${saved.id}`);

    return this.findOne(saved.id);
  }

  async updateStorage(
    id: string,
    storageLocation: string,
    userId: string,
    userName?: string,
  ): Promise<Specimen> {
    const specimen = await this.findOne(id);

    const previousLocation = specimen.storageLocation;
    specimen.storageLocation = storageLocation;
    specimen.updatedBy = userId;

    // Add to chain of custody
    const custodyEntry = {
      timestamp: new Date(),
      action: 'STORAGE_UPDATE',
      userId: userId,
      userName: userName,
      location: storageLocation,
      notes: previousLocation
        ? `Moved from ${previousLocation} to ${storageLocation}`
        : `Stored at ${storageLocation}`,
    };

    specimen.chainOfCustody = [...(specimen.chainOfCustody || []), custodyEntry];

    const saved = await this.specimenRepository.save(specimen);
    this.logger.log(`Specimen storage updated: ${saved.id}`);

    return this.findOne(saved.id);
  }

  private validateStatusTransition(currentStatus: SpecimenStatus, newStatus: SpecimenStatus): void {
    const validTransitions: Record<SpecimenStatus, SpecimenStatus[]> = {
      [SpecimenStatus.COLLECTED]: [SpecimenStatus.RECEIVED, SpecimenStatus.REJECTED],
      [SpecimenStatus.RECEIVED]: [SpecimenStatus.PROCESSING, SpecimenStatus.REJECTED],
      [SpecimenStatus.PROCESSING]: [SpecimenStatus.STORED, SpecimenStatus.DISCARDED],
      [SpecimenStatus.STORED]: [SpecimenStatus.DISCARDED],
      [SpecimenStatus.DISCARDED]: [],
      [SpecimenStatus.REJECTED]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }
}
