import { Injectable, Inject, forwardRef, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, DataSource } from 'typeorm';
import { Record } from '../entities/record.entity';
import { RecordVersion } from '../entities/record-version.entity';
import { CreateRecordDto } from '../dto/create-record.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { PaginatedRecordsResponseDto } from '../dto/paginated-response.dto';
import { RecentRecordDto } from '../dto/recent-record.dto';
import { IpfsService } from './ipfs.service';
import { StellarService } from './stellar.service';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { ProviderPatientRelationshipService } from '../../provider-patient/services/provider-patient-relationship.service';

@Injectable()
export class RecordsService {
  constructor(
    @InjectRepository(Record)
    private recordRepository: Repository<Record>,
    private dataSource: DataSource,
    private ipfsService: IpfsService,
    private stellarService: StellarService,
    @Inject(forwardRef(() => AccessControlService))
    private accessControlService: AccessControlService,
    private auditLogService: AuditLogService,
    @Inject(forwardRef(() => ProviderPatientRelationshipService))
    private providerPatientService: ProviderPatientRelationshipService,
  ) {}

  async uploadRecord(
    dto: CreateRecordDto,
    encryptedBuffer: Buffer,
    providerId?: string,
  ): Promise<{ recordId: string; cid: string; stellarTxHash: string }> {
    const cid = await this.ipfsService.upload(encryptedBuffer);
    const stellarTxHash = await this.stellarService.anchorCid(dto.patientId, cid);

    return this.dataSource.transaction(async (manager) => {
      const record = manager.create(Record, {
        patientId: dto.patientId,
        cid,
        stellarTxHash,
        recordType: dto.recordType,
        description: dto.description,
      });

      const savedRecord = await manager.save(record);

      if (providerId) {
        await manager.query(
          `INSERT INTO provider_patient_relationships
             ("providerId", "patientId", "firstInteractionAt", "recordCount")
           VALUES ($1, $2, NOW(), 1)
           ON CONFLICT ("providerId", "patientId")
           DO UPDATE SET
             "recordCount" = provider_patient_relationships."recordCount" + 1`,
          [providerId, dto.patientId],
        );
      }

      return {
        recordId: savedRecord.id,
        cid: savedRecord.cid,
        stellarTxHash: savedRecord.stellarTxHash,
      };
    });
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedRecordsResponseDto> {
    const {
      page = 1,
      pageSize = 20,
      recordType,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      order = 'desc',
      patientId,
    } = query;

    const where: FindOptionsWhere<Record> = { isDeleted: false };
    if (recordType) where.recordType = recordType;
    if (patientId) where.patientId = patientId;
    if (fromDate && toDate) {
      where.createdAt = Between(new Date(fromDate), new Date(toDate));
    } else if (fromDate) {
      where.createdAt = Between(new Date(fromDate), new Date());
    } else if (toDate) {
      where.createdAt = Between(new Date(0), new Date(toDate));
    }

    return PaginationUtil.paginate(
      this.recordRepository,
      { page, pageSize },
      {
        where,
        order: {
          [sortBy]: order.toUpperCase() as any,
        },
      },
    );
  }

  async generateQrCode(id: string, patientId: string): Promise<string> {
    const record = await this.recordRepository.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`Record ${id} not found`);

    const token = await this.stellarService.createShareLink(id, patientId);
    const appDomain = process.env.APP_DOMAIN || 'https://app.domain.com';
    const url = `${appDomain}/share/${token}`;
    return QRCode.toDataURL(url);
  }

  async findOne(
    id: string,
    requesterId?: string,
    includeDeleted = false,
    version?: number,
  ): Promise<Record | (Record & { _version: RecordVersion })> {
    const record = await this.recordRepository.findOne({ where: { id } });

    if (!record || (!includeDeleted && record.isDeleted)) {
      throw new NotFoundException(`Record ${id} not found`);
    }

    if (record && requesterId) {
      const emergencyGrant = await this.accessControlService.findActiveEmergencyGrant(
        record.patientId,
        requesterId,
        id,
      );

      if (emergencyGrant) {
        await this.auditLogService.create({
          operation: 'EMERGENCY_ACCESS',
          entityType: 'records',
          entityId: id,
          userId: requesterId,
          status: 'success',
          newValues: {
            patientId: record.patientId,
            grantId: emergencyGrant.id,
            recordId: id,
          },
        });
      }
    }

    // If a specific version is requested, overlay the versioned CID and hash
    if (version !== undefined) {
      const recordVersion = await this.recordVersionService.findVersion(id, version);
      if (!recordVersion) {
        throw new NotFoundException(`Version ${version} of record ${id} not found`);
      }
      return Object.assign(Object.create(Object.getPrototypeOf(record)), record, {
        cid: recordVersion.cid,
        stellarTxHash: recordVersion.stellarTxHash,
        _version: recordVersion,
      });
    }

    return record;
  }

  async findRecent(): Promise<RecentRecordDto[]> {
    const records = await this.recordRepository.find({
      order: {
        createdAt: 'DESC',
      },
      take: 50,
      cache: 30000, // 30 seconds cache
    });

    return records.map((record) => ({
      recordId: record.id,
      patientAddress: this.truncateAddress(record.patientId),
      providerAddress: 'System', // As records entity doesn't have providerId yet, defaulting to 'System'
      recordType: record.recordType,
      createdAt: record.createdAt,
    }));
  }

  private truncateAddress(address: string): string {
    if (address.length <= 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
  /**
   * Derive the current state of a record by replaying its event stream.
   * Falls back to the latest snapshot + delta events for performance.
   */
  async getStateFromEvents(id: string): Promise<RecordState> {
    const state = await this.eventStore.replayToState(id);
    if (!state || state.deleted) {
      throw new NotFoundException(`Record ${id} not found in event store`);
    }
    return state;
  }

  /**
   * Return the raw event stream for a record (admin only).
   */
  async getEventStream(id: string): Promise<RecordEvent[]> {
    const events = await this.eventStore.getEvents(id);
    if (events.length === 0) {
      throw new NotFoundException(`No events found for record ${id}`);
    }
    return events;
  }

  /**
   * Search records with dynamic filtering via QueryBuilder.
   *
   * Access control:
   *  - Admin / Physician: can search all records, including by arbitrary patientAddress
   *  - Patient / other roles: always scoped to their own patientId; patientAddress param ignored
   *
   * CID masking:
   *  - Raw IPFS CIDs are only included when the caller is the record owner (patientId === callerId)
   */
  async search(
    dto: SearchRecordsDto,
    callerId: string,
    callerRole: string,
  ): Promise<SearchRecordsResponseDto> {
    const { patientAddress, providerAddress, type, from, to, q, page = 1, pageSize = 20 } = dto;

    const isPrivileged =
      callerRole === UserRole.ADMIN || callerRole === (UserRole as any).PHYSICIAN || callerRole === 'physician';

    const qb = this.recordRepository
      .createQueryBuilder('record')
      .select([
        'record.id',
        'record.patientId',
        'record.providerId',
        'record.cid',
        'record.stellarTxHash',
        'record.recordType',
        'record.description',
        'record.createdAt',
      ])
      // Always exclude soft-deleted records from search results
      .andWhere('record.isDeleted = :isDeleted', { isDeleted: false });

    // ── Access control scoping ────────────────────────────────────────────
    if (isPrivileged) {
      // Admin/Physician: honour the optional patientAddress filter
      if (patientAddress) {
        qb.andWhere('record.patientId = :patientAddress', { patientAddress });
      }
    } else {
      // Non-privileged: always restrict to own records, ignore patientAddress param
      qb.andWhere('record.patientId = :callerId', { callerId });
    }

    // ── Dynamic filters ───────────────────────────────────────────────────
    if (providerAddress) {
      qb.andWhere('record.providerId = :providerAddress', { providerAddress });
    }

    if (type) {
      qb.andWhere('record.recordType = :type', { type });
    }

    if (from) {
      qb.andWhere('record.createdAt >= :from', { from: new Date(from) });
    }

    if (to) {
      qb.andWhere('record.createdAt <= :to', { to: new Date(to) });
    }

    // ── Full-text search on description ───────────────────────────────────
    if (q) {
      qb.andWhere('record.description ILIKE :q', { q: `%${q}%` });
    }

    // ── Pagination ────────────────────────────────────────────────────────
    const skip = (page - 1) * pageSize;
    qb.orderBy('record.createdAt', 'DESC').skip(skip).take(pageSize);

    const [records, total] = await qb.getManyAndCount();

    // ── CID masking: strip raw CID for non-owners ─────────────────────────
    const data: SearchRecordItem[] = records.map((r) => {
      const isOwner = r.patientId === callerId;
      return {
        id: r.id,
        patientId: r.patientId,
        providerId: r.providerId ?? null,
        stellarTxHash: r.stellarTxHash ?? null,
        recordType: r.recordType,
        description: r.description ?? null,
        createdAt: r.createdAt,
        // Only expose raw CID to the record owner
        ...(isOwner || isPrivileged ? { cid: r.cid } : {}),
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
