import {
  Injectable,
  Inject,
  forwardRef,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { Traced } from '../../common/decorators/traced.decorator';
import * as QRCode from 'qrcode';
import { Record } from '../entities/record.entity';
import { RecordVersion } from '../entities/record-version.entity';
import { CreateRecordDto } from '../dto/create-record.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { PaginatedRecordsResponseDto } from '../dto/paginated-response.dto';
import { RecentRecordDto } from '../dto/recent-record.dto';
import { IpfsWithBreakerService } from './ipfs-with-breaker.service';
import { StellarService } from './stellar.service';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { RecordEventStoreService, RecordState } from './record-event-store.service';
import { RecordEvent, RecordEventType } from '../entities/record-event.entity';
import { RecordResponseDto } from '../dto/record-response.dto';
import { UserRole } from '../../auth/entities/user.entity';

@Injectable()
export class RecordsService {
  constructor(
    @InjectRepository(Record)
    private recordRepository: Repository<Record>,
    private dataSource: DataSource,
    private ipfsService: IpfsWithBreakerService,
    private stellarService: StellarService,
    @Inject(forwardRef(() => AccessControlService))
    private accessControlService: AccessControlService,
    private auditLogService: AuditLogService,
    @Inject(forwardRef(() => ProviderPatientRelationshipService))
    private providerPatientService: ProviderPatientRelationshipService,
  ) {}

  @Traced('records.upload')
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

  @Traced('records.findAll')
  async findAll(
    query: PaginationQueryDto,
    caller?: { userId?: string; role?: string },
  ): Promise<PaginatedRecordsResponseDto> {
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
    const limit = Math.min(Math.max(Number(pageSize) || 20, 1), 100);

    const where: FindOptionsWhere<Record> = { isDeleted: false };
    if (recordType) where.recordType = recordType;
    if (patientId) where.patientId = patientId;

    // Tenant isolation is enforced by TenantInterceptor (schema-per-tenant
    // search_path). Within the tenant, non-privileged callers (patients and
    // any role other than admin/physician) only ever see their own records,
    // regardless of the patientId filter they supply.
    if (caller) {
      const isPrivileged =
        caller.role === UserRole.ADMIN ||
        caller.role === UserRole.SUPER_ADMIN ||
        caller.role === UserRole.PHYSICIAN;
      if (!isPrivileged) {
        if (!caller.userId) {
          throw new ForbiddenException('Authenticated caller required');
        }
        where.patientId = caller.userId;
      }
    }

    if (fromDate && toDate) {
      where.createdAt = Between(new Date(fromDate), new Date(toDate));
    } else if (fromDate) {
      where.createdAt = Between(new Date(fromDate), new Date());
    } else if (toDate) {
      where.createdAt = Between(new Date(0), new Date(toDate));
    }

    const dir = order.toUpperCase() as 'ASC' | 'DESC';
    const skip = (page - 1) * limit;

    // Always append `id` as a deterministic tie-breaker so rows with identical
    // primary-sort values never shift between pages.
    const [data, total] = await this.recordRepository.findAndCount({
      where,
      order: { [sortBy]: dir, id: dir },
      take: limit,
      skip,
    });

    const totalPages = Math.ceil(total / limit);
    // Expose the last-seen id so callers can use keyset pagination if desired.
    const nextCursor = data.length > 0 ? data[data.length - 1].id : null;

    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      nextCursor,
    };

    return { data, meta };
  }

  async generateQrCode(id: string, patientId: string): Promise<string> {
    const record = await this.recordRepository.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`Record ${id} not found`);

    // Only the record's own patient may mint a share link / QR code for it.
    if (!patientId || record.patientId !== patientId) {
      throw new ForbiddenException('Only the record owner can generate a share link');
    }

    const token = await this.stellarService.createShareLink(id, patientId);
    const appDomain = process.env.APP_DOMAIN || 'https://app.domain.com';
    const url = `${appDomain}/share/${token}`;
    return QRCode.toDataURL(url);
  }

  @Traced('records.findOne', { 'phi.access': 'true' })
  async findOne(
    id: string,
    requesterId?: string,
    includeDeleted = false,
  ): Promise<Record> {
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

  async findOneById(
    id: string,
    requesterId: string,
    requesterRole: UserRole,
    preloadedRecord?: Record,
  ): Promise<RecordResponseDto> {
    const record =
      preloadedRecord ??
      (await this.recordRepository.findOne({
        where: { id },
      }));

    if (!record) {
      throw new NotFoundException(`Record ${id} not found`);
    }

    con

/* … truncated 5687 chars — edit only what you need near the top … */
