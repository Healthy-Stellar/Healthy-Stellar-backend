import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Or } from 'typeorm';
import { RecordTemplate } from '../entities/record-template.entity';
import { Record } from '../entities/record.entity';
import { CreateTemplateDto } from '../dto/create-template.dto';
import { CreateRecordFromTemplateDto } from '../dto/create-record-from-template.dto';

@Injectable()
export class RecordTemplateService {
  constructor(
    @InjectRepository(RecordTemplate)
    private readonly templateRepository: Repository<RecordTemplate>,
    @InjectRepository(Record)
    private readonly recordRepository: Repository<Record>,
  ) {}

  async create(providerId: string, dto: CreateTemplateDto): Promise<RecordTemplate> {
    this.validateSchemaJson(dto.schemaJson);

    const template = this.templateRepository.create({
      providerId,
      name: dto.name,
      recordType: dto.recordType,
      schemaJson: dto.schemaJson,
      isPublic: dto.isPublic ?? false,
    });

    return this.templateRepository.save(template);
  }

  async findAll(providerId: string): Promise<RecordTemplate[]> {
    return this.templateRepository
      .createQueryBuilder('t')
      .where('t.isPublic = :isPublic OR t.providerId = :providerId', {
        isPublic: true,
        providerId,
      })
      .orderBy('t.createdAt', 'DESC')
      .getMany();
  }

  async createRecordFromTemplate(
    templateId: string,
    providerId: string,
    dto: CreateRecordFromTemplateDto,
  ): Promise<Record> {
    const template = await this.templateRepository.findOne({ where: { id: templateId } });

    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }

    if (!template.isPublic && template.providerId !== providerId) {
      throw new ForbiddenException('Access to this template is not allowed');
    }

    const mergedSchema = dto.fieldValues
      ? { ...template.schemaJson, ...dto.fieldValues }
      : { ...template.schemaJson };

    const record = this.recordRepository.create({
      patientId: dto.patientId,
      recordType: template.recordType,
      description: dto.description ?? `Created from template: ${template.name}`,
      cid: '',
      stellarTxHash: '',
    });

    return this.recordRepository.save(record);
  }

  private validateSchemaJson(schema: Record<string, any>): void {
    if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
      throw new BadRequestException('schemaJson must be a valid JSON object');
    }
    try {
      JSON.stringify(schema);
    } catch {
      throw new BadRequestException('schemaJson contains non-serializable values');
    }
  }
}
