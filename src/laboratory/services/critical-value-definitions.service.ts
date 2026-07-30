import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CriticalValueDefinition } from '../entities/critical-value-definition.entity';
import { CreateCriticalValueDefinitionDto } from '../dto/create-critical-value-definition.dto';

@Injectable()
export class CriticalValueDefinitionsService {
  constructor(
    @InjectRepository(CriticalValueDefinition)
    private readonly repo: Repository<CriticalValueDefinition>,
  ) {}

  create(dto: CreateCriticalValueDefinitionDto, userId: string): Promise<CriticalValueDefinition> {
    return this.repo.save(this.repo.create({ ...dto, createdBy: userId }));
  }

  findAll(): Promise<CriticalValueDefinition[]> {
    return this.repo.find({ where: { isActive: true }, order: { testCode: 'ASC' } });
  }

  async findOne(id: string): Promise<CriticalValueDefinition> {
    const def = await this.repo.findOne({ where: { id } });
    if (!def) throw new NotFoundException(`CriticalValueDefinition ${id} not found`);
    return def;
  }

  async update(id: string, dto: Partial<CreateCriticalValueDefinitionDto>): Promise<CriticalValueDefinition> {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.update(id, { isActive: false });
  }
}
