import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalNoteTemplate, TemplateCategory } from '../entities/clinical-note-template.entity';
import { CreateClinicalTemplateDto } from '../dto/create-clinical-template.dto';

@Injectable()
export class ClinicalTemplatesService {
  private readonly logger = new Logger(ClinicalTemplatesService.name);

  constructor(
    @InjectRepository(ClinicalNoteTemplate)
    private templateRepository: Repository<ClinicalNoteTemplate>,
  ) {}

  async create(
    createDto: CreateClinicalTemplateDto,
    userId: string,
  ): Promise<ClinicalNoteTemplate> {
    const template = this.templateRepository.create({
      ...createDto,
      createdBy: userId,
    });

    const saved = await this.templateRepository.save(template);
    this.logger.log(`Clinical template created: ${saved.id}`);
    return saved;
  }

  async findAll(category?: TemplateCategory): Promise<ClinicalNoteTemplate[]> {
    const where: any = { isActive: true };
    if (category) {
      where.category = category;
    }

    return this.templateRepository.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<ClinicalNoteTemplate> {
    const template = await this.templateRepository.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException(`Clinical template with ID ${id} not found`);
    }

    return template;
  }

  async update(
    id: string,
    updateDto: Partial<CreateClinicalTemplateDto>,
  ): Promise<ClinicalNoteTemplate> {
    const template = await this.findOne(id);
    Object.assign(template, updateDto);
    return this.templateRepository.save(template);
  }

  async delete(id: string): Promise<void> {
    const template = await this.findOne(id);

    if (template.isSystemTemplate) {
      throw new Error('Cannot delete system templates');
    }

    template.isActive = false;
    await this.templateRepository.save(template);
    this.logger.log(`Clinical template deactivated: ${id}`);
  }
}
