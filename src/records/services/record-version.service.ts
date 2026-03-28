import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Record } from '../entities/record.entity';
import { RecordVersion } from '../entities/record-version.entity';
import { RecordEvent, RecordEventType } from '../entities/record-event.entity';
import { RecordEventStoreService } from './record-event-store.service';
import { IpfsService } from './ipfs.service';
import { StellarService } from './stellar.service';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { RecordAmended } from '../../event-store/domain-events';
import { AmendRecordDto } from '../dto/amend-record.dto';
import {
  AmendRecordResponseDto,
  PaginatedVersionsResponseDto,
  RecordVersionMetaDto,
} from '../dto/record-version-response.dto';

@Injectable()
export class RecordVersionService {
  private readonly logger = new Logger(RecordVersionService.name);

  constructor(
    @InjectRepository(RecordVersion)
    private readonly versionRepo: Repository<RecordVersion>,
    @InjectRepository(Record)
    private readonly recordRepo: Repository<Record>,
    private readonly ipfsService: IpfsService,
    private readonly stellarService: StellarService,
    @Inject(forwardRef(() => AccessControlService))
    private readonly accessControlService: AccessControlService,
    private readonly notificationsService: NotificationsService,
    private readonly eventStore: RecordEventStoreService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create version 1 for a newly uploaded record.
   * Called by RecordsService immediately after the initial upload.
   */
  async createInitialVersion(
    recordId: string,
    cid: string,
    stellarTxHash: string | null,
    uploadedBy: string,
  ): Promise<RecordVersion> {
    const v1 = this.versionRepo.create({
      recordId,
      version: 1,
      cid,
      stellarTxHash,
      amendedBy: uploadedBy,
      amendmentReason: 'Initial upload',
    });
    return this.versionRepo.save(v1);
  }

  /**
   * Upload a new version of a record.
   *
   * Rules:
   *  - Only the record owner (patient) may amend.
   *  - amendmentReason must be >= 20 chars (enforced by DTO).
   *  - Version numbers are sequential and never reused.
   *  - Dispatches RecordAmended domain event and Soroban anchor call.
   *  - Notifies all active grantees via WebSocket / push.
   */
  async amend(
    recordId: string,
    dto: AmendRecordDto,
    encryptedBuffer: Buffer,
    requesterId: string,
  ): Promise<AmendRecordResponseDto> {
    const record = await this.recordRepo.findOne({ where: { id: recordId } });
    if (!record || record.isDeleted) {
      throw new NotFoundException(`Record ${recordId} not found`);
    }

    if (record.patientId !== requesterId) {
      throw new ForbiddenException('Only the record owner may amend this record');
    }

    // Upload new content to IPFS
    const cid = await this.ipfsService.upload(encryptedBuffer);

    // Anchor new CID on Stellar
    let stellarTxHash: string | null = null;
    try {
      stellarTxHash = await this.stellarService.anchorCid(record.patientId, cid);
    } catch (err: any) {
      this.logger.warn(`Stellar anchoring failed for amendment of ${recordId}: ${err.message}`);
    }

    // Assign the next sequential version number within a transaction
    const savedVersion = await this.dataSource.transaction(async (manager) => {
      const lastVersion = await manager
        .createQueryBuilder(RecordVersion, 'v')
        .where('v.recordId = :recordId', { recordId })
        .orderBy('v.version', 'DESC')
        .setLock('pessimistic_write')
        .getOne();

      const nextVersion = lastVersion ? lastVersion.version + 1 : 2; // v1 was created at upload

      const version = manager.create(RecordVersion, {
        recordId,
        version: nextVersion,
        cid,
        stellarTxHash,
        amendedBy: requesterId,
        amendmentReason: dto.amendmentReason,
      });

      const saved = await manager.save(RecordVersion, version);

      // Update the read model (records table) to the latest CID/hash
      await manager.update(Record, { id: recordId }, { cid, stellarTxHash: stellarTxHash ?? undefined });

      return saved;
    });

    // Append RECORD_AMENDED event to the event store
    await this.eventStore.append(
      recordId,
      RecordEventType.RECORD_AMENDED,
      {
        version: savedVersion.version,
        cid,
        stellarTxHash,
        amendedBy: requesterId,
        amendmentReason: dto.amendmentReason,
      },
      requesterId,
    );

    // Dispatch RecordAmended domain event
    const domainEvent = new RecordAmended(
      recordId,
      { amendedBy: requesterId, changes: { cid, version: savedVersion.version } },
    );
    this.eventEmitter.emit('RecordAmended', domainEvent);

    // Notify all active grantees
    await this.notifyGrantees(record.patientId, recordId, requesterId, savedVersion.version);

    this.logger.log(`Record ${recordId} amended to v${savedVersion.version} by ${requesterId}`);

    return {
      recordId,
      version: savedVersion.version,
      cid,
      stellarTxHash,
    };
  }

  /**
   * Return paginated version history for a record (metadata only — no file content).
   * Access check: requester must be the patient, an admin, or an active grantee.
   */
  async getVersions(
    recordId: string,
    requesterId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedVersionsResponseDto> {
    const record = await this.recordRepo.findOne({ where: { id: recordId } });
    if (!record || record.isDeleted) {
      throw new NotFoundException(`Record ${recordId} not found`);
    }

    await this.assertAccess(record.patientId, recordId, requesterId);

    const skip = (page - 1) * pageSize;

    const [versions, total] = await this.versionRepo.findAndCount({
      where: { recordId },
      order: { version: 'ASC' },
      skip,
      take: pageSize,
    });

    return {
      data: versions.map(this.toMeta),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Retrieve a specific historical version by number.
   * Access check applies.
   */
  async getVersion(
    recordId: string,
    version: number,
    requesterId: string,
  ): Promise<RecordVersionMetaDto> {
    const record = await this.recordRepo.findOne({ where: { id: recordId } });
    if (!record || record.isDeleted) {
      throw new NotFoundException(`Record ${recordId} not found`);
    }

    await this.assertAccess(record.patientId, recordId, requesterId);

    const v = await this.versionRepo.findOne({ where: { recordId, version } });
    if (!v) {
      throw new NotFoundException(`Version ${version} of record ${recordId} not found`);
    }

    return this.toMeta(v);
  }

  /**
   * Return the RecordVersion row for a specific version number (used internally by diff service).
   * Does NOT perform an access check — caller is responsible.
   */
  async findVersion(recordId: string, version: number): Promise<RecordVersion | null> {
    return this.versionRepo.findOne({ where: { recordId, version } });
  }

  /**
   * Return the latest version number for a record.
   */
  async getLatestVersionNumber(recordId: string): Promise<number> {
    const last = await this.versionRepo.findOne({
      where: { recordId },
      order: { version: 'DESC' },
    });
    return last?.version ?? 1;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async assertAccess(patientId: string, recordId: string, requesterId: string): Promise<void> {
    if (patientId === requesterId) return;

    const hasGrant = await this.accessControlService.verifyAccess(requesterId, recordId);
    if (!hasGrant) {
      const hasEmergency = await this.accessControlService.findActiveEmergencyGrant(
        patientId,
        requesterId,
        recordId,
      );
      if (!hasEmergency) {
        throw new ForbiddenException('Access denied');
      }
    }
  }

  private async notifyGrantees(
    patientId: string,
    recordId: string,
    amendedBy: string,
    version: number,
  ): Promise<void> {
    try {
      const grants = await this.accessControlService.getPatientGrants(patientId);
      const relevantGrants = grants.filter(
        (g) => g.recordIds.includes('*') || g.recordIds.includes(recordId),
      );

      for (const grant of relevantGrants) {
        this.notificationsService.emitRecordAmended(amendedBy, recordId, {
          targetUserId: grant.granteeId,
          recordId,
          version,
          amendedBy,
        });
      }
    } catch (err: any) {
      this.logger.warn(`Failed to notify grantees for amendment of ${recordId}: ${err.message}`);
    }
  }

  private toMeta(v: RecordVersion): RecordVersionMetaDto {
    return {
      id: v.id,
      recordId: v.recordId,
      version: v.version,
      cid: v.cid,
      stellarTxHash: v.stellarTxHash ?? null,
      amendedBy: v.amendedBy,
      amendmentReason: v.amendmentReason,
      createdAt: v.createdAt,
    };
  }
}
