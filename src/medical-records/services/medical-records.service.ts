import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like, Between } from 'typeorm';
import { MedicalRecord, MedicalRecordStatus } from '../entities/medical-record.entity';
import { MedicalRecordVersion } from '../entities/medical-record-version.entity';
import { MedicalHistory, HistoryEventType } from '../entities/medical-history.entity';
import { CreateMedicalRecordDto } from '../dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from '../dto/update-medical-record.dto';
import { SearchMedicalRecordsDto } from '../dto/search-medical-records.dto';

@Injectable()
export class MedicalRecordsService {
  private readonly logger = new Logger(MedicalRecordsService.name);

  constructor(
    @InjectRepository(MedicalRecord)
    private medicalRecordRepository: Repository<MedicalRecord>,
    @InjectRepository(MedicalRecordVersion)
    private versionRepository: Repository<MedicalRecordVersion>,
    @InjectRepository(MedicalHistory)
    private historyRepository: Repository<MedicalHistory>,
  ) {}

  async create(
    createDto: CreateMedicalRecordDto,
    userId: string,
    userName?: string,
  ): Promise<MedicalRecord> {
    const record = this.medicalRecordRepository.create({
      ...createDto,
      createdBy: userId,
      recordDate: createDto.recordDate ? new Date(createDto.recordDate) : new Date(),
    });

    const savedRecord = await this.medicalRecordRepository.save(record);
    
    // Reload to get the proper version number
    const recordWithVersion = await this.medicalRecordRepository.findOne({
      where: { id: savedRecord.id },
    });

    // Create initial version
    const currentContent = JSON.stringify({
      title: recordWithVersion.title,
      description: recordWithVersion.description,
      recordType: recordWithVersion.recordType,
      status: recordWithVersion.status,
      metadata: recordWithVersion.metadata,
    });
    
    try {
      await this.createVersion(recordWithVersion, null, currentContent, userId, userName, 'Initial record creation');
    } catch (error) {
      this.logger.error(`Failed to create initial version: ${error.message}`, error.stack);
      // Continue even if version creation fails
    }

    // Create history entry
    await this.createHistoryEntry(
      savedRecord.id,
      savedRecord.patientId,
      HistoryEventType.CREATED,
      'Medical record created',
      userId,
      userName,
    );

    this.logger.log(`Medical record created: ${savedRecord.id} by user ${userId}`);
    return savedRecord;
  }

  async findOne(id: string, patientId?: string): Promise<MedicalRecord> {
    const where: FindOptionsWhere<MedicalRecord> = { id };

    if (patientId) {
      where.patientId = patientId;
    }

    const record = await this.medicalRecordRepository.findOne({
      where,
      relations: ['versions', 'attachments', 'consents'],
      order: {
        versions: { createdAt: 'DESC' },
      },
    });

    if (!record) {
      throw new NotFoundException(`Medical record with ID ${id} not found`);
    }

    return record;
  }

  async update(
    id: string,
    updateDto: UpdateMedicalRecordDto,
    userId: string,
    userName?: string,
    changeReason?: string,
  ): Promise<MedicalRecord> {
    const record = await this.findOne(id);

    if (record.status === MedicalRecordStatus.DELETED) {
      throw new BadRequestException('Cannot update a deleted record');
    }

    // Store previous content for versioning
    const previousContent = JSON.stringify({
      title: record.title,
      description: record.description,
      recordType: record.recordType,
      status: record.status,
      metadata: record.metadata,
    });

    // Update record
    Object.assign(record, {
      ...updateDto,
      updatedBy: userId,
      recordDate: updateDto.recordDate ? new Date(updateDto.recordDate) : record.recordDate,
    });

    const updatedRecord = await this.medicalRecordRepository.save(record);

    // Create version
    const currentContent = JSON.stringify({
      title: updatedRecord.title,
      description: updatedRecord.description,
      recordType: updatedRecord.recordType,
      status: updatedRecord.status,
      metadata: updatedRecord.metadata,
    });

    await this.createVersion(
      updatedRecord,
      previousContent,
      currentContent,
      userId,
      userName,
      changeReason || 'Record updated',
    );

    // Create history entry
    await this.createHistoryEntry(
      updatedRecord.id,
      updatedRecord.patientId,
      HistoryEventType.UPDATED,
      'Medical record updated',
      userId,
      userName,
      { changes: updateDto },
    );

    this.logger.log(`Medical record updated: ${id} by user ${userId}`);
    return updatedRecord;
  }

  async search(searchDto: SearchMedicalRecordsDto): Promise<{
    data: MedicalRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      patientId,
      recordType,
      status,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = searchDto;

    const queryBuilder = this.medicalRecordRepository.createQueryBuilder('record');

    if (patientId) {
      queryBuilder.andWhere('record.patientId = :patientId', { patientId });
    }

    if (recordType) {
      queryBuilder.andWhere('record.recordType = :recordType', { recordType });
    }

    if (status) {
      queryBuilder.andWhere('record.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere(
        '(record.title ILIKE :search OR record.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (startDate || endDate) {
      if (startDate && endDate) {
        queryBuilder.andWhere('record.recordDate BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      } else if (startDate) {
        queryBuilder.andWhere('record.recordDate >= :startDate', { startDate });
      } else if (endDate) {
        queryBuilder.andWhere('record.recordDate <= :endDate', { endDate });
      }
    }

    queryBuilder
      .orderBy(`record.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async getTimeline(patientId: string, limit: number = 50): Promise<MedicalHistory[]> {
    return this.historyRepository.find({
      where: { patientId },
      order: { eventDate: 'DESC' },
      take: limit,
    });
  }

  async getVersions(recordId: string): Promise<MedicalRecordVersion[]> {
    return this.versionRepository.find({
      where: { medicalRecordId: recordId },
      order: { versionNumber: 'DESC' },
    });
  }

  async archive(id: string, userId: string, userName?: string): Promise<MedicalRecord> {
    const record = await this.findOne(id);
    record.status = MedicalRecordStatus.ARCHIVED;
    record.updatedBy = userId;

    const archived = await this.medicalRecordRepository.save(record);

    await this.createHistoryEntry(
      archived.id,
      archived.patientId,
      HistoryEventType.ARCHIVED,
      'Medical record archived',
      userId,
      userName,
    );

    return archived;
  }

  async restore(id: string, userId: string, userName?: string): Promise<MedicalRecord> {
    const record = await this.findOne(id);

    if (record.status !== MedicalRecordStatus.ARCHIVED) {
      throw new BadRequestException('Only archived records can be restored');
    }

    record.status = MedicalRecordStatus.ACTIVE;
    record.updatedBy = userId;

    const restored = await this.medicalRecordRepository.save(record);

    await this.createHistoryEntry(
      restored.id,
      restored.patientId,
      HistoryEventType.RESTORED,
      'Medical record restored',
      userId,
      userName,
    );

    return restored;
  }

  async delete(id: string, userId: string, userName?: string): Promise<void> {
    const record = await this.findOne(id);
    record.status = MedicalRecordStatus.DELETED;
    record.updatedBy = userId;

    await this.medicalRecordRepository.save(record);

    await this.createHistoryEntry(
      record.id,
      record.patientId,
      HistoryEventType.DELETED,
      'Medical record deleted',
      userId,
      userName,
    );

    this.logger.log(`Medical record deleted: ${id} by user ${userId}`);
  }

  private async createVersion(
    record: MedicalRecord,
    previousContent: string | null,
    currentContent: string,
    userId: string,
    userName?: string,
    changeReason?: string,
  ): Promise<MedicalRecordVersion> {
    // Get the current version number (default to 1 if not set)
    const versionNumber = record.version || 1;
    
    const version = this.versionRepository.create({
      medicalRecordId: record.id,
      versionNumber: versionNumber,
      previousContent,
      currentContent,
      changedBy: userId,
      changedByName: userName,
      changeReason: changeReason || 'Record modified',
      changes: previousContent
        ? this.calculateChanges(previousContent, currentContent)
        : null,
    });

    return this.versionRepository.save(version);
  }

  private async createHistoryEntry(
    recordId: string,
    patientId: string,
    eventType: HistoryEventType,
    description: string,
    userId: string,
    userName?: string,
    eventData?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MedicalHistory> {
    const history = this.historyRepository.create({
      medicalRecordId: recordId,
      patientId,
      eventType,
      eventDescription: description,
      performedBy: userId,
      performedByName: userName,
      eventData,
      ipAddress,
      userAgent,
    });

    return this.historyRepository.save(history);
  }

  private calculateChanges(
    previousContent: string,
    currentContent: string,
  ): Record<string, any> {
    try {
      const previous = JSON.parse(previousContent);
      const current = JSON.parse(currentContent);
      const changes: Record<string, any> = {};

      for (const key in current) {
        if (previous[key] !== current[key]) {
          changes[key] = {
            from: previous[key],
            to: current[key],
          };
        }
      }

      return changes;
    } catch (error) {
      return { raw: { previous: previousContent, current: currentContent } };
    }
  }

  async recordView(
    recordId: string,
    patientId: string,
    userId: string,
    userName?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createHistoryEntry(
      recordId,
      patientId,
      HistoryEventType.VIEWED,
      'Medical record viewed',
      userId,
      userName,
      undefined,
      ipAddress,
      userAgent,
    );
  }
}
