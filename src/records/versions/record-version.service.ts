import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RecordVersion } from './record-version.entity';
import { AmendRecordDto } from './dto/amend-record.dto';
import { PaginatedVersionHistoryDto, VersionMetaDto } from './dto/version-history.dto';
import { RecordAmendedEvent } from '../events/record-amended.event';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { IpfsService } from '../services/ipfs.service';
import { StellarService } from '../services/stellar.service';
import { Record } from '../entities/record.entity';
import { UserRole } from '../../auth/entities/user.entity';

// Stub types removed - using actual services

@Injectable()
export class RecordVersionService {
  private readonly logger = new Logger(RecordVersionService.name);

  constructor(
    @InjectRepository(RecordVersion)
    private readonly versionRepo: Repository<RecordVersion>,
    @InjectRepository(Record)
    private readonly recordRepo: Repository<Record>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly accessCheck: AccessControlService,
    private readonly ipfs: IpfsService,
    private readonly stellar: StellarService,
  ) {}

  async amend(
    recordId: string,
    dto: AmendRecordDto,
    file: Express.Multer.File,
    userId: string,
    encryptedDek: string,
  ): Promise<VersionMetaDto> {
    const record = await this.recordRepo.findOne({ where: { id: recordId } });
    if (!record) throw new NotFoundException(`Record ${recordId} not found`);

    if (record.patientId !== userId) {
      throw new ForbiddenException('Only the record owner may amend this record');
    }

    return this.dataSource.transaction(async (manager) => {
      const versionRepo = manager.getRepository(RecordVersion);

      // Lock the record's versions to safely derive next version number
      const latest = await versionRepo
        .createQueryBuilder('rv')
        .where('rv.recordId = :recordId', { recordId })
        .orderBy('rv.version', 'DESC')
        .setLock('pessimistic_write')
        .getOne();

      if (!latest) {
        throw new NotFoundException(`Record ${recordId} has no base version. Upload it first.`);
      }

      const nextVersion = latest.version + 1;

      // Real IPFS upload
      const cid = await this.ipfs.upload(file.buffer);

      // Real Stellar anchoring
      let stellarTxHash: string | null = null;
      try {
        stellarTxHash = await this.stellar.anchorCid(record.patientId, cid);
      } catch (err) {
        this.logger.warn(`Stellar anchoring failed, continuing: ${err.message}`);
      }

      const newVersion = versionRepo.create({
        recordId,
        version: nextVersion,
        cid,
        encryptedDek,
        stellarTxHash,
        amendedBy: userId,
        amendmentReason: dto.amendmentReason,
      });

      const saved = await versionRepo.save(newVersion);

      // Real grantee lookup via AccessControlService
      const grants = await this.accessCheck.getPatientGrants(record.patientId);
      const granteeIds = grants
        .filter(g => g.recordIds.includes('*') || g.recordIds.includes(recordId))
        .map(g => g.granteeId);

      this.eventEmitter.emit(
        'record.amended',
        new RecordAmendedEvent(
          recordId,
          nextVersion,
          cid,
          userId,
          dto.amendmentReason,
          stellarTxHash,
          granteeIds,
        ),
      );

      return this.toMeta(saved);
    });
  }

  async getVersionHistory(
    recordId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedVersionHistoryDto> {
    const record = await this.recordRepo.findOne({ where: { id: recordId } });
    if (!record) throw new NotFoundException(`Record ${recordId} not found`);

    const hasAccess = await this.accessCheck.canAccessRecord(
      record.patientId,
      userId,
      UserRole.PATIENT, // Default role check
      recordId,
    );
    if (!hasAccess) throw new ForbiddenException('Access denied');

    const [rows, total] = await this.versionRepo.findAndCount({
      where: { recordId },
      order: { version: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: rows.map(this.toMeta),
      total,
      page,
      limit,
    };
  }

  async getSpecificVersion(
    recordId: string,
    version: number,
    userId: string,
  ): Promise<VersionMetaDto> {
    const record = await this.recordRepo.findOne({ where: { id: recordId } });
    if (!record) throw new NotFoundException(`Record ${recordId} not found`);

    const hasAccess = await this.accessCheck.canAccessRecord(
      record.patientId,
      userId,
      UserRole.PATIENT,
      recordId,
    );
    if (!hasAccess) throw new ForbiddenException('Access denied');

    const versionData = await this.versionRepo.findOne({ where: { recordId, version } });
    if (!versionData) {
      throw new NotFoundException(`Version ${version} of record ${recordId} not found.`);
    }

    return this.toMeta(versionData);
  }

  async getLatestOrVersion(
    recordId: string,
    userId: string,
    version?: number,
  ): Promise<VersionMetaDto> {
    const record = await this.recordRepo.findOne({ where: { id: recordId } });
    if (!record) throw new NotFoundException(`Record ${recordId} not found`);

    const hasAccess = await this.accessCheck.canAccessRecord(
      record.patientId,
      userId,
      UserRole.PATIENT,
      recordId,
    );
    if (!hasAccess) throw new ForbiddenException('Access denied');

    if (version !== undefined) {
      return this.getSpecificVersion(recordId, version, userId);
    }

    const latest = await this.versionRepo.findOne({
      where: { recordId },
      order: { version: 'DESC' },
    });

    if (!latest) {
      throw new NotFoundException(`Record ${recordId} not found.`);
    }

    return this.toMeta(latest);
  }

  async createInitialVersion(params: {
    recordId: string;
    cid: string;
    encryptedDek: string;
    uploadedBy: string;
    stellarTxHash?: string;
  }): Promise<RecordVersion> {
    const existing = await this.versionRepo.findOne({
      where: { recordId: params.recordId, version: 1 },
    });

    if (existing) {
      throw new BadRequestException(`Record ${params.recordId} already has a v1.`);
    }

    const v1 = this.versionRepo.create({
      recordId: params.recordId,
      version: 1,
      cid: params.cid,
      encryptedDek: params.encryptedDek,
      stellarTxHash: params.stellarTxHash ?? null,
      amendedBy: params.uploadedBy,
      amendmentReason: 'Initial upload',
    });

    return this.versionRepo.save(v1);
  }

  private toMeta(v: RecordVersion): VersionMetaDto {
    return {
      id: v.id,
      recordId: v.recordId,
      version: v.version,
      cid: v.cid,
      stellarTxHash: v.stellarTxHash,
      amendedBy: v.amendedBy,
      amendmentReason: v.amendmentReason,
      createdAt: v.createdAt,
    };
  }
}
