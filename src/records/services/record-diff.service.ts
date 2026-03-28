import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Record } from '../entities/record.entity';
import { RecordVersion } from '../entities/record-version.entity';
import { AccessControlService } from '../../access-control/services/access-control.service';
import { ChangeType, FieldChangeDto, RecordDiffResponseDto } from '../dto/record-diff.dto';

/** Fields considered "metadata" for diff purposes. Binary content is excluded. */
const DIFFABLE_FIELDS: Array<keyof RecordVersion> = [
  'amendedBy',
  'amendmentReason',
  'stellarTxHash',
];

/** TTL for cached diff results (10 minutes). */
const CACHE_TTL_SECONDS = 600;

@Injectable()
export class RecordDiffService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecordDiffService.name);
  private redis: Redis;

  constructor(
    @InjectRepository(Record)
    private readonly recordRepo: Repository<Record>,
    @InjectRepository(RecordVersion)
    private readonly versionRepo: Repository<RecordVersion>,
    @Inject(forwardRef(() => AccessControlService))
    private readonly accessControlService: AccessControlService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get<number>('REDIS_DB', 0),
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  /**
   * Compute a structured diff between two versions of a record's metadata.
   *
   * Access rules:
   *  - Requester must have access to the record (owner, grantee, or emergency grant).
   *  - The same grant covers all versions — a single access check is sufficient.
   *
   * Caching:
   *  - Results are cached in Redis for 10 minutes keyed by (recordId, from, to).
   */
  async computeDiff(
    recordId: string,
    fromVersion: number,
    toVersion: number,
    requesterId: string,
  ): Promise<RecordDiffResponseDto> {
    const record = await this.recordRepo.findOne({ where: { id: recordId } });
    if (!record || record.isDeleted) {
      throw new NotFoundException(`Record ${recordId} not found`);
    }

    await this.assertAccess(record.patientId, recordId, requesterId);

    const cacheKey = `record-diff:${recordId}:${fromVersion}:${toVersion}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for diff ${cacheKey}`);
      return JSON.parse(cached) as RecordDiffResponseDto;
    }

    const [fromV, toV] = await Promise.all([
      this.versionRepo.findOne({ where: { recordId, version: fromVersion } }),
      this.versionRepo.findOne({ where: { recordId, version: toVersion } }),
    ]);

    if (!fromV) {
      throw new NotFoundException(`Version ${fromVersion} of record ${recordId} not found`);
    }
    if (!toV) {
      throw new NotFoundException(`Version ${toVersion} of record ${recordId} not found`);
    }

    const changes = this.diffMetadata(fromV, toV);
    const binaryContentChanged = fromV.cid !== toV.cid;

    const result: RecordDiffResponseDto = {
      recordId,
      fromVersion,
      toVersion,
      changes,
      amendedBy: toV.amendedBy,
      amendmentReason: toV.amendmentReason,
      amendedAt: toV.createdAt.toISOString(),
      binaryContentChanged,
    };

    // Cache the result
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);

    return result;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private diffMetadata(from: RecordVersion, to: RecordVersion): FieldChangeDto[] {
    const changes: FieldChangeDto[] = [];

    for (const field of DIFFABLE_FIELDS) {
      const oldValue = from[field] ?? null;
      const newValue = to[field] ?? null;

      if (oldValue === null && newValue !== null) {
        changes.push({ field, oldValue, newValue, changeType: 'added' });
      } else if (oldValue !== null && newValue === null) {
        changes.push({ field, oldValue, newValue, changeType: 'removed' });
      } else if (oldValue !== newValue) {
        changes.push({ field, oldValue, newValue, changeType: 'modified' });
      }
    }

    return changes;
  }

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
}
