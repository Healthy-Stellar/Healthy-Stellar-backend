import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Drug } from '../entities/drug.entity';
import { CreateDrugDto } from '../dto/create-drug.dto';

@Injectable()
export class DrugService {
  constructor(
    @InjectRepository(Drug)
    private drugRepository: Repository<Drug>,
  ) {}

  async create(createDrugDto: CreateDrugDto): Promise<Drug> {
    // Check if NDC code already exists
    const existing = await this.drugRepository.findOne({
      where: { ndcCode: createDrugDto.ndcCode }
    });

    if (existing) {
      throw new ConflictException(`Drug with NDC code ${createDrugDto.ndcCode} already exists`);
    }

    const drug = this.drugRepository.create(createDrugDto);
    return await this.drugRepository.save(drug);
  }

  async findAll(): Promise<Drug[]> {
    return await this.drugRepository.find({
      where: { isActive: true },
      relations: ['inventory']
    });
  }

  async findOne(id: string): Promise<Drug> {
    const drug = await this.drugRepository.findOne({
      where: { id },
      relations: ['inventory']
    });

    if (!drug) {
      throw new NotFoundException(`Drug with ID ${id} not found`);
    }

    return drug;
  }

  async findByNDC(ndcCode: string): Promise<Drug> {
    const drug = await this.drugRepository.findOne({
      where: { ndcCode }
    });

    if (!drug) {
      throw new NotFoundException(`Drug with NDC ${ndcCode} not found`);
    }

    return drug;
  }

  async searchDrugs(searchTerm: string): Promise<Drug[]> {
    return await this.drugRepository
      .createQueryBuilder('drug')
      .where('drug.brandName ILIKE :search', { search: `%${searchTerm}%` })
      .orWhere('drug.genericName ILIKE :search', { search: `%${searchTerm}%` })
      .orWhere('drug.ndcCode LIKE :search', { search: `%${searchTerm}%` })
      .andWhere('drug.isActive = :active', { active: true })
      .getMany();
  }

  async getControlledSubstances(schedule?: string): Promise<Drug[]> {
    const query = this.drugRepository
      .createQueryBuilder('drug')
      .where('drug.controlledSubstanceSchedule != :nonControlled', { nonControlled: 'non-controlled' })
      .andWhere('drug.isActive = :active', { active: true });

    if (schedule) {
      query.andWhere('drug.controlledSubstanceSchedule = :schedule', { schedule });
    }

    return await query.getMany();
  }
}