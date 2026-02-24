import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportTemplate, TemplateStatus } from '../entities/report-template.entity';
import { CreateReportTemplateDto } from '../dto/create-report-template.dto';

@Injectable()
export class ReportTemplateService {
  private readonly logger = new Logger(ReportTemplateService.name);

  constructor(
    @InjectRepository(ReportTemplate)
    private templateRepository: Repository<ReportTemplate>,
  ) {}

  async create(createDto: CreateReportTemplateDto, userId: string): Promise<ReportTemplate> {
    const template = this.templateRepository.create({
      ...createDto,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.templateRepository.save(template);
    this.logger.log(`Report template created: ${saved.id}`);

    return saved;
  }

  async findAll(): Promise<ReportTemplate[]> {
    return this.templateRepository.find({
      where: { status: TemplateStatus.ACTIVE },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<ReportTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Report template with ID ${id} not found`);
    }

    return template;
  }

  async findByOrgan(organType: string): Promise<ReportTemplate[]> {
    return this.templateRepository.find({
      where: {
        organType,
        status: TemplateStatus.ACTIVE,
      },
      order: { name: 'ASC' },
    });
  }

  async activate(id: string, userId: string): Promise<ReportTemplate> {
    const template = await this.findOne(id);

    template.status = TemplateStatus.ACTIVE;
    template.approvedBy = userId;
    template.approvedDate = new Date();
    template.updatedBy = userId;

    return this.templateRepository.save(template);
  }

  async deactivate(id: string, userId: string): Promise<ReportTemplate> {
    const template = await this.findOne(id);

    template.status = TemplateStatus.INACTIVE;
    template.updatedBy = userId;

    return this.templateRepository.save(template);
  }
}
