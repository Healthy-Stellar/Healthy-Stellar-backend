import { Injectable, Inject, forwardRef, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import * as QRCode from 'qrcode';
import { Record } from '../entities/record.entity';
import { CreateRecordDto } from '../dto/create-record.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { PaginatedRecordsResponseDto, PaginationMeta } from '../dto/paginated-response.dto';
import { RecentRecordDto } from '../dto/recent-record.dto';
import { SingleRecordResponseDto } from '../dto/single-record-response.dto';
import { IpfsService } from './ipfs.service';
import { StellarService } from './stellar.service';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { RecordEventStoreService, RecordState } from './record-event-store.service';
import { RecordEvent, RecordEventType } from '../entities/record-event.entity';

@Injectable()
export class RecordsService {
  constructor(
    @InjectRepository(Record)
    private recordRepository: Repository<Record>,
    private ipfsService: IpfsService,
    private stellarService: StellarService,
    @Inject(forwardRef(() => AccessControlService))
    private accessControlService: AccessControlService,
    private auditLogService: AuditLogService,
    private eventStore: RecordEventStoreService,
  ) { }

  async uploadRecord(
    dto: CreateRecordDto,
    encryptedBuffer: Buffer,
    causedBy?: string,
  ): Promise<{ recordId: string; cid: string; stellarTxHash: string }> {
    const cid = await this.ipfsService.upload(encryptedBuffer);
    const stellarTxHash = await this.stellarService.anchorCid(dto.patientId, cid);

    // Persist to the records table (read model / projection)
    const record = this.recordRepository.create({
      patientId: dto.patientId,
      cid,
      stellarTxHash,
      recordType: dto.recordType,
      description: dto.description,
    });
    const savedRecord = await this.recordRepository.save(record);

    // Append the creation event to the event store
    await this.eventStore.append(
      savedRecord.id,
      RecordEventType.RECORD_CREATED,
      {
        patientId: dto.patientId,
        cid,
        stellarTxHash,
        recordType: dto.recordType,
        description: dto.description ?? null,
        createdAt: savedRecord.createdAt,
      },
      causedBy,
    );

    return {
      recordId: savedRecord.id,
      cid: savedRecord.cid,
      stellarTxHash: savedRecord.stellarTxHash,
    };
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedRecordsResponseDto> {
    const {
      page = 1,
      limit = 20,
      recordType,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      order = 'desc',
      patientId,
    } = query;

    const where: FindOptionsWhere<Record> = {};
    if (recordType) where.recordType = recordType;
    if (patientId) where.patientId = patientId;
    if (fromDate && toDate) {
      where.createdAt = Between(new Date(fromDate), new Date(toDate));
    } else if (fromDate) {
      where.createdAt = Between(new Date(fromDate), new Date());
    } else if (toDate) {
      where.createdAt = Between(new Date(0), new Date(toDate));
    }

    const skip = (page - 1) * limit;
    const [data, total] = await this.recordRepository.findAndCount({
      where,
      order: {
        [sortBy]: order.toUpperCase() as any,
      },
      order: { [sortBy]: order.toUpperCase() },
      take: limit,
      skip,
    });

    const totalPages = Math.ceil(total / limit);
    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };

    return { data, meta };
  }

  async generateQrCode(id: string, patientId: string): Promise<string> {
    const record = await this.recordRepository.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`Record ${id} not found`);

    const token = await this.stellarService.createShareLink(id, patientId);
    const appDomain = process.env.APP_DOMAIN || 'https://app.domain.com';
    const url = `${appDomain}/share/${token}`;
    return QRCode.toDataURL(url);
  }

  async findOne(id: string, requesterId?: string): Promise<Record> {
    const record = await this.recordRepository.findOne({ where: { id } });

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

    return record;
  }

  /**
   * Retrieve a single record by ID with full access control enforcement.
   * - Patient can fetch their own records
   * - Providers need active access grant
   * - Returns 404 for non-existent or soft-deleted records
   * - Response includes record metadata but NOT raw IPFS CID for non-owners
   * - Audit log entry created on every fetch
   */
  async findOneWithAccessControl(
    recordId: string,
    requesterId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<SingleRecordResponseDto> {
    // 1. Load record from database
    const record = await this.recordRepository.findOne({ where: { id: recordId } });

    // 2. Check if record exists and is not soft-deleted
    if (!record || record.isDeleted) {
      throw new NotFoundException(`Record ${recordId} not found`);
    }

    // 3. Determine if requester is the owner (patient)
    const isOwner = record.patientId === requesterId;

    // 4. If not owner, verify access grant
    if (!isOwner) {
      const hasAccess = await this.accessControlService.verifyAccess(requesterId, recordId);
      if (!hasAccess) {
        throw new ForbiddenException('No active access grant for this record');
      }
    }

    // 5. Create audit log entry
    await this.auditLogService.create({
      operation: 'RECORD_READ',
      entityType: 'records',
      entityId: recordId,
      userId: requesterId,
      ipAddress,
      userAgent,
      status: 'success',
      newValues: {
        recordId,
        patientId: record.patientId,
        isOwner,
      },
    });

    // 6. Build response - hide CID and Stellar hash from non-owners
    return {
      id: record.id,
      patientId: record.patientId,
      providerId: record.providerId ?? null,
      recordType: record.recordType,
      description: record.description ?? null,
      createdAt: record.createdAt,
      cid: isOwner ? record.cid : null,
      stellarTxHash: isOwner ? record.stellarTxHash : null,
    };
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
}
