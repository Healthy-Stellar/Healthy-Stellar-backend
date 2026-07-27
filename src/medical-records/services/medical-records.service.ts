import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, DataSource, EntityManager } from 'typeorm';
import { MedicalRecord, MedicalRecordStatus } from '../entities/medical-record.entity';
import { MedicalRecordVersion } from '../entities/medical-record-version.entity';
import { MedicalHistory, HistoryEventType } from '../entities/medical-history.entity';
import { CreateMedicalRecordDto } from '../dto/create-medical-record.dto';
import { UpdateMedicalRecordDto } from '../dto/update-medical-record.dto';
import { SearchMedicalRecordsDto } from '../dto/search-medical-records.dto';
import { FullTextSearchDto } from '../dto/full-text-search.dto';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { ProviderPatientRelationshipService } from '../../provider-patient/services/provider-patient-relationship.service';

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
    private readonly dataSource: DataSource,
    private readonly accessControlService: AccessControlService,
    private readonly auditLogService: AuditLogService,
    private readonly providerPatientService: ProviderPatientRelationshipService,
  ) {}

  async create(
    createDto: CreateMedicalRecordDto,
    userId: string,
    userName?: string,
    organizationId?: string,
  ): Promise<MedicalRecord> {
    return this.dataSource.transaction(async (manager) => {
      const record = manager.create(MedicalRecord, {
        ...createDto,
        createdBy: userId,
        organizationId,
        recordDate: createDto.recordDate ? new Date(createDto.recordDate) : new Date(),
      });

      const savedRecord = await manager.save(record);

      // Track provider-patient relationship atomically
      if (savedRecord.providerId) {
        await manager.query(
          `INSERT INTO provider_patient_relationships
             ("providerId", "patientId", "firstInteractionAt", "recordCount")
           VALUES ($1, $2, NOW(), 1)
           ON CONFLICT ("providerId", "patientId")
           DO UPDATE SET
             "recordCount" = provider_patient_relationships."recordCount" + 1`,
          [savedRecord.providerId, savedRecord.patientId],
        );
      }

      // Reload to get the proper version number
      const recordWithVersion = await manager.findOne(MedicalRecord, {
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

      await this.createVersion(
        recordWithVersion,
        null,
        currentContent,
        userId,
        userName,
        'Initial record creation',
        manager,
      );

      // Create history entry
      await this.createHistoryEntry(
        savedRecord.id,
        savedRecord.patientId,
        HistoryEventType.CREATED,
        'Medical record created',
        userId,
        userName,
        undefined,
        undefined,
        undefined,
        manager,
      );

      this.logger.log(`Medical record created: ${savedRecord.id} by user ${userId}`);
      return savedRecord;
    });
  }

  async findOne(id: string, patientId?: string, organizationId?: string): Promise<MedicalRecord> {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    const queryBuilder = this.medicalRecordRepository
      .createQueryBuilder('record')
      .leftJoinAndSelect('record.versions', 'version')
      .leftJoinAndSelect('record.attachments', 'attachment')
      .leftJoinAndSelect('record.consents', 'consent')
      .where('record.id = :id', { id })
      .andWhere('record.organizationId = :organizationId', { organizationId })
      .orderBy('version.createdAt', 'DESC');

    if (patientId) {
      queryBuilder.andWhere('record.patientId = :patientId', { patientId });
    }

    const record = await queryBuilder.getOne();

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
    organizationId?: string,
  ): Promise<MedicalRecord> {
    if (!organizationId) throw new BadRequestException('organizationId is required');
    const record = await this.findOne(id, undefined, organizationId);

    if (record.status === MedicalRecordStatus.DELETED) {
      throw new BadRequestException('Cannot update a deleted record');
    }

    if (updateDto.expectedVersion !== undefined && record.version !== updateDto.expectedVersion) {
      throw new ConflictException(
        `Record has been modified by another user (expected version ${updateDto.expectedVersion}, current version ${record.version}). Please refresh the record and retry your update.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const previousContent = JSON.stringify({
        title: record.title,
        description: record.description,
        recordType: record.recordType,
        status: record.status,
        metadata: record.metadata,
      });

      Object.assign(record, {
        ...updateDto,
        updatedBy: userId,
        recordDate: updateDto.recordDate ? new Date(updateDto.recordDate) : record.recordDate,
      });

      const updatedRecord = await manager.save(MedicalRecord, record);

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
        manager,
      );

      await this.createHistoryEntry(
        updatedRecord.id,
        updatedRecord.patientId,
        HistoryEventType.UPDATED,
        'Medical record updated',
        userId,
        userName,
        { changes: updateDto },
        undefined,
        undefined,
        manager,
      );

      this.logger.log(`Medical record updated: ${id} by user ${userId}`);
      return updatedRecord;
    });
  }

  async search(searchDto: SearchMedicalRecordsDto, organizationId?: string): Promise<{
    data: MedicalRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    if (!organizationId) throw new BadRequestException('organizationId is required');

    const {
      patientId,
      recordType,
      status,
      search,
      startDate,
      endDate,
      page = 1,
      pageSize,
      limit,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = searchDto;

    const pageSizeValue = pageSize ?? limit ?? 20;

    const queryBuilder = this.medicalRecordRepository.createQueryBuilder('record');

    queryBuilder.andWhere('record.organizationId = :organizationId', { organizationId });

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
      queryBuilder.andWhere('(record.title ILIKE :search OR record.description ILIKE :search)', {
        search: `%${search}%`,
      });
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
      .skip((page - 1) * pageSizeValue)
      .take(pageSizeValue);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit: pageSizeValue,
    };
  }

  /**
   * Full-text search across medical records with relevance ranking.
   *
   * Uses PostgreSQL's built-in `ts_rank` on the `search_vector` column
   * which is maintained via a DB trigger (see migration
   * `AddMedicalRecordFullTextSearch1746500000000`).
   *
   * Search query syntax (via `websearch_to_tsquery`):
   *  - Plain words:  `hypertension` → matches documents containing "hypertension"
   *  - Multiple terms: `hypertension diabetes` → matches documents containing both
   *  - Phrase search: `"chronic kidney disease"` → exact phrase match
   *  - Proximity: `diabetes <-> hypertension` → terms adjacent (PG native syntax)
   *  - AND/OR: `hypertension OR diabetes` → logical operators
   *
   * Results are ordered by `ts_rank` descending (most relevant first).
   * Additional filters (patientId, recordType, status, dateRange) narrow
   * the result set while preserving relevance ranking.
   */
  async searchFulltext(
    searchDto: FullTextSearchDto,
    organizationId?: string,
  ): Promise<{
    data: MedicalRecord[];
    total: number;
    page: number;
    limit: number;
    relevance: Record<string, number>;
  }> {
    if (!organizationId) throw new BadRequestException('organizationId is required');
    if (!searchDto.q || searchDto.q.trim().length === 0) {
      throw new BadRequestException('Search query "q" is required');
    }

    const {
      q,
      patientId,
      recordType,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = searchDto;

    // Build the tsquery from the user's search string using websearch_to_tsquery
    // which supports: plain terms, AND/OR, phrase (double-quoted), and proximity
    const tsQuery = `websearch_to_tsquery('english', :q)`;

    // Base query: select records with full-text relevance
    const queryBuilder = this.medicalRecordRepository
      .createQueryBuilder('record')
      .addSelect(
        `ts_rank(record.search_vector, ${tsQuery})`,
        'relevance',
      )
      .where(`${tsQuery} @@ record.search_vector`)
      .andWhere('record.organizationId = :organizationId', { organizationId })
      .setParameter('q', q);

    // Optional filters
    if (patientId) {
      queryBuilder.andWhere('record.patientId = :patientId', { patientId });
    }

    if (recordType) {
      queryBuilder.andWhere('record.recordType = :recordType', { recordType });
    }

    if (status) {
      queryBuilder.andWhere('record.status = :status', { status });
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

    // Count total results (without pagination)
    const total = await queryBuilder.getCount();

    // Order by relevance (highest first), then by recency as tiebreaker
    queryBuilder
      .orderBy('relevance', 'DESC')
      .addOrderBy('record.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // Use getRawAndEntities to retrieve both the entity data and the computed
    // 'relevance' column (ts_rank score) in a single query
    const rawAndEntities = await queryBuilder.getRawAndEntities();
    const data = rawAndEntities.entities;
    const relevance: Record<string, number> = {};
    for (const raw of rawAndEntities.raw) {
      // The raw result alias depends on the query builder — TypeORM prefixes
      // with the alias ('record_') for the id column
      const idKey = Object.keys(raw).find(
        (k) => k.endsWith('_id') && raw[k] !== null,
      );
      const recordId = idKey ? raw[idKey] : raw.id;
      if (recordId && raw.relevance !== undefined) {
        relevance[recordId] = parseFloat(raw.relevance) || 0;
      }
    }

    return {
      data,
      total,
      page,
      limit,
      relevance,
    };
  }

  async getTimeline(patientId: string, limit: number = 50, organizationId?: string): Promise<MedicalHistory[]> {
    if (!organizationId) throw new BadRequestException('organizationId is required');

    return this.historyRepository.find({
      where: { patientId, organizationId } as any,
      order: { eventDate: 'DESC' },
      take: limit,
    });
  }

  async getVersions(recordId: string, organizationId?: string): Promise<MedicalRecordVersion[]> {
    if (!organizationId) throw new BadRequestException('organizationId is required');

    const record = await this.medicalRecordRepository.findOne({
      where: { id: recordId, organizationId },
    });

    if (!record) {
      throw new NotFoundException(`Medical record with ID ${recordId} not found or does not belong to your organization`);
    }

    return this.versionRepository.find({
      where: { medicalRecordId: recordId },
      order: { versionNumber: 'DESC' },
    });
  }

  async archive(id: string, userId: string, userName?: string, organizationId?: string): Promise<MedicalRecord> {
    const record = await this.findOne(id, undefined, organizationId);

    return this.dataSource.transaction(async (manager) => {
      record.status = MedicalRecordStatus.ARCHIVED;
      record.updatedBy = userId;

      const archived = await manager.save(MedicalRecord, record);

      await this.createHistoryEntry(
        archived.id,
        archived.patientId,
        HistoryEventType.ARCHIVED,
        'Medical record archived',
        userId,
        userName,
        undefined,
        undefined,
        undefined,
        manager,
      );

      return archived;
    });
  }

  async restore(id: string, userId: string, userName?: string, organizationId?: string): Promise<MedicalRecord> {
    const record = await this.findOne(id, undefined, organizationId);

    if (record.status !== MedicalRecordStatus.ARCHIVED) {
      throw new BadRequestException('Only archived records can be restored');
    }

    return this.dataSource.transaction(async (manager) => {
      record.status = MedicalRecordStatus.ACTIVE;
      record.updatedBy = userId;

      const restored = await manager.save(MedicalRecord, record);

      await this.createHistoryEntry(
        restored.id,
        restored.patientId,
        HistoryEventType.RESTORED,
        'Medical record restored',
        userId,
        userName,
        undefined,
        undefined,
        undefined,
        manager,
      );

      return restored;
    });
  }

  async delete(id: string, userId: string, userName?: string, organizationId?: string): Promise<void> {
    const record = await this.findOne(id, undefined, organizationId);

    await this.dataSource.transaction(async (manager) => {
      record.status = MedicalRecordStatus.DELETED;
      record.updatedBy = userId;

      await manager.save(MedicalRecord, record);

      await this.createHistoryEntry(
        record.id,
        record.patientId,
        HistoryEventType.DELETED,
        'Medical record deleted',
        userId,
        userName,
        undefined,
        undefined,
        undefined,
        manager,
      );
    });

    this.logger.log(`Medical record deleted: ${id} by user ${userId}`);
  }

  private async createVersion(
    record: MedicalRecord,
    previousContent: string | null,
    currentContent: string,
    userId: string,
    userName?: string,
    changeReason?: string,
    manager?: EntityManager,
  ): Promise<MedicalRecordVersion> {
    const repo = manager ? manager.getRepository(MedicalRecordVersion) : this.versionRepository;
    const versionNumber = record.version || 1;

    const version = repo.create({
      medicalRecordId: record.id,
      versionNumber,
      previousContent,
      currentContent,
      changedBy: userId,
      changedByName: userName,
      changeReason: changeReason || 'Record modified',
      changes: previousContent ? this.calculateChanges(previousContent, currentContent) : null,
    });

    return repo.save(version);
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
    manager?: EntityManager,
  ): Promise<MedicalHistory> {
    const repo = manager ? manager.getRepository(MedicalHistory) : this.historyRepository;

    const history = repo.create({
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

    return repo.save(history);
  }

  private calculateChanges(previousContent: string, currentContent: string): Record<string, any> {
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

    const emergencyGrant = await this.accessControlService.findActiveEmergencyGrant(
      patientId,
      userId,
      recordId,
    );

    await this.auditLogService.create({
      operation: emergencyGrant ? 'EMERGENCY_ACCESS' : 'RECORD_READ',
      entityType: 'medical_records',
      entityId: recordId,
      userId,
      ipAddress,
      userAgent,
      status: 'success',
      changes: {
        patientId,
        isEmergency: Boolean(emergencyGrant),
        emergencyGrantId: emergencyGrant?.id,
      },
    });
  }

  async shareWithHospital(recordId: string, hospitalId: string): Promise<void> {
    const record = await this.medicalRecordRepository.findOne({
      where: { id: recordId },
    });
    if (!record) {
      throw new NotFoundException(`Medical record ${recordId} not found`);
    }

    record.organizationId = hospitalId;
    await this.medicalRecordRepository.save(record);

    this.logger.log(`Medical record ${recordId} shared with hospital ${hospitalId}`);
  }
}
