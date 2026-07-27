import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DrugWaste, WasteReason, DisposalMethod } from '../entities/drug-waste.entity';
import { PharmacyInventoryService } from './pharmacy-inventory.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';

@Injectable()
export class DrugWasteService {
  constructor(
    @InjectRepository(DrugWaste)
    private wasteRepository: Repository<DrugWaste>,
    private inventoryService: PharmacyInventoryService,
  ) {}

  async create(createDto: Partial<DrugWaste>): Promise<DrugWaste> {
    // Verify inventory exists
    await this.inventoryService.getInventoryItem(createDto.inventoryId);

    const wasteNumber = `WST-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const waste = this.wasteRepository.create({
      ...createDto,
      wasteNumber,
      totalCost: createDto.quantity * createDto.unitCost,
    });

    // Deduct from specific inventory item
    await this.inventoryService.deductInventoryItem(createDto.inventoryId, createDto.quantity);

    return this.wasteRepository.save(waste);
  }

  async findAll(paginationDto: PaginationDto = new PaginationDto()): Promise<PaginatedResponseDto<DrugWaste>> {
    return PaginationUtil.paginate(this.wasteRepository, paginationDto, {
      relations: ['inventory', 'inventory.drug'],
      order: { wasteDate: 'DESC' },
    });
  }

  async findOne(id: string): Promise<DrugWaste> {
    const waste = await this.wasteRepository.findOne({
      where: { id },
      relations: ['inventory', 'inventory.drug'],
    });
    if (!waste) {
      throw new NotFoundException(`Drug waste record with ID ${id} not found`);
    }
    return waste;
  }

  async getWasteByReason(
    reason: WasteReason,
    paginationDto: PaginationDto = new PaginationDto(),
  ): Promise<PaginatedResponseDto<DrugWaste>> {
    const query = this.wasteRepository.createQueryBuilder('waste')
      .leftJoinAndSelect('waste.inventory', 'inventory')
      .leftJoinAndSelect('inventory.drug', 'drug')
      .where('waste.reason = :reason', { reason })
      .orderBy('waste.wasteDate', 'DESC');

    return PaginationUtil.paginateQueryBuilder(query, paginationDto);
  }

  async getWasteByDateRange(
    startDate: Date,
    endDate: Date,
    paginationDto: PaginationDto = new PaginationDto(),
  ): Promise<PaginatedResponseDto<DrugWaste>> {
    const query = this.wasteRepository
      .createQueryBuilder('waste')
      .leftJoinAndSelect('waste.inventory', 'inventory')
      .leftJoinAndSelect('inventory.drug', 'drug')
      .where('waste.wasteDate BETWEEN :startDate AND :endDate', { startDate, endDate })
      .orderBy('waste.wasteDate', 'DESC');

    return PaginationUtil.paginateQueryBuilder(query, paginationDto);
  }

  async getTotalWasteCost(startDate?: Date, endDate?: Date): Promise<number> {
    const query = this.wasteRepository.createQueryBuilder('waste');

    if (startDate && endDate) {
      query.where('waste.wasteDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    const result = await query.select('SUM(waste.totalCost)', 'total').getRawOne();

    return parseFloat(result.total) || 0;
  }

  async getControlledSubstanceWaste(
    paginationDto: PaginationDto = new PaginationDto(),
  ): Promise<PaginatedResponseDto<DrugWaste>> {
    const query = this.wasteRepository
      .createQueryBuilder('waste')
      .leftJoinAndSelect('waste.inventory', 'inventory')
      .leftJoinAndSelect('inventory.drug', 'drug')
      .where('drug.controlledSubstanceSchedule != :schedule', { schedule: 'non-controlled' })
      .andWhere('waste.requiresDEAForm = :requires', { requires: true })
      .orderBy('waste.wasteDate', 'DESC');

    return PaginationUtil.paginateQueryBuilder(query, paginationDto);
  }

  async updateDisposalDetails(id: string, disposalDetails: any): Promise<DrugWaste> {
    const waste = await this.findOne(id);
    waste.disposalDetails = disposalDetails;
    return this.wasteRepository.save(waste);
  }

  async getWasteReport(
    filters: {
      reason?: WasteReason;
      startDate?: Date;
      endDate?: Date;
      drugId?: string;
    },
    paginationDto: PaginationDto = new PaginationDto(),
  ): Promise<PaginatedResponseDto<DrugWaste>> {
    const query = this.wasteRepository
      .createQueryBuilder('waste')
      .leftJoinAndSelect('waste.inventory', 'inventory')
      .leftJoinAndSelect('inventory.drug', 'drug');

    if (filters.reason) {
      query.andWhere('waste.reason = :reason', { reason: filters.reason });
    }

    if (filters.startDate && filters.endDate) {
      query.andWhere('waste.wasteDate BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    if (filters.drugId) {
      query.andWhere('inventory.drugId = :drugId', { drugId: filters.drugId });
    }

    return PaginationUtil.paginateQueryBuilder(query.orderBy('waste.wasteDate', 'DESC'), paginationDto);
  }
}
