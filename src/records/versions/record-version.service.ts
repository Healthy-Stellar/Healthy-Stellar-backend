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
import { PaginatedVersionHistoryDto, VersionMetaDto } from './version-history.dto.ts';
import { RecordAmendedEvent } from '../events/record-amended.event';

// Stub interfaces — replace with actual imports from their respective modules
interface RecordAccessCheckService {
  assertCanAccess(recordId: string, userId: string): Promise<void>;
  assertIsOwnerOrAdmin(recordId: string, userId: string): Promise<void>;
  getGranteeIds(recordId: string): Promise<string[]>;
}

interface IpfsService {
  uploadVersion(recordId: string, file: Express.Multer.File): Promise<{ cid: string }>;
}

interface SorobanRecordService {
  anchorAmendment(params: {
    recordId: string;
    version: number;
    cid: string;
    amendedBy: string;
  }): Promise<{ txHash: string }>;
}

@Injectable()
export class RecordVersionService {
  private readonly logger = new Logger(RecordVersionService.name);

  constructor(
    @InjectRepository(RecordVersion)
    private readonly versionRepo: Repository<RecordVersion>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    // TODO: inject when modules are available
    // private readonly accessCheck: RecordAccessCheckService,
    // private readonly ipfs: IpfsService,
    // private readonly soroban: SorobanRecordService,
  ) {}

  async amend(
    recordId: string,
    dto: AmendRecordDto,
    file: Express.Multer.File,
    userId: string,
    encryptedDek: string,
  ): Promise<VersionMetaDto> {
    // await this.accessCheck.assertIsOwnerOrAdmin(recordId, userId);

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

      // TODO: replace stub with actual IPFS upload
      // const { cid } = await this.ipfs.uploadVersion(recordId, file);
      const cid = `stub-cid-v${nextVersion}`;

      // TODO: replace stub with actual Soroban call
      // const { txHash } = await this.soroban.anchorAmendment({ recordId, version: nextVersion, cid, amendedBy: userId });
      const stellarTxHash: string | null = null;

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

      // TODO: replace stub with actual grantee lookup
      // const granteeIds = await this.accessCheck.getGranteeIds(recordId);
      const granteeIds: string[] = [];

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
    // await this.accessCheck.assertCanAccess(recordId, userId);

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
    // await this.accessCheck.assertCanAccess(recordId, userId);

    const record = await this.versionRepo.findOne({ where: { recordId, version } });
    if (!record) {
      throw new NotFoundException(`Version ${version} of record ${recordId} not found.`);
    }

    return this.toMeta(record);
  }

  async getLatestOrVersion(
    recordId: string,
    userId: string,
    version?: number,
  ): Promise<VersionMetaDto> {
    // await this.accessCheck.assertCanAccess(recordId, userId);

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
