import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { SensitiveAuditLog } from '../entities/sensitive-audit-log.entity';
import { QueryAuditLogsDto } from '../audit/dto/query-audit-logs.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';
import { PaginationUtil } from '../utils/pagination.util';

export interface CreateAuditLogDto {
  operation: string;
  entityType: string;
  entityId?: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, any>;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  status?: string;
  errorMessage?: string;
  executionTimeMs?: number;
  requestId?: string;
  sessionId?: string;
}

/** Entry shape for tamper-evident sensitive action logging */
export interface SensitiveAuditEntry {
  actorAddress: string;
  action: string;
  targetAddress?: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

export type PaginatedAuditLogs = PaginatedResponseDto<SensitiveAuditLog>;

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(SensitiveAuditLog)
    private readonly sensitiveRepo: Repository<SensitiveAuditLog>,
  ) {}

  async create(auditLogData: CreateAuditLogDto): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      ...auditLogData,
      timestamp: new Date(),
    });
    return this.auditLogRepository.save(auditLog);
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { entityType, entityId },
      order: { timestamp: 'DESC' },
    });
  }

  async findByUser(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async findByOperation(operation: string, limit: number = 100): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { operation },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
    return this.auditLogRepository
      .createQueryBuilder('audit_log')
      .where('audit_log.timestamp >= :startDate', { startDate })
      .andWhere('audit_log.timestamp <= :endDate', { endDate })
      .orderBy('audit_log.timestamp', 'DESC')
      .getMany();
  }

  async getStatistics(): Promise<any> {
    const total = await this.auditLogRepository.count();
    const byOperation = await this.auditLogRepository
      .createQueryBuilder('audit_log')
      .select('audit_log.operation', 'operation')
      .addSelect('COUNT(*)', 'count')
      .groupBy('audit_log.operation')
      .getRawMany();

    const byStatus = await this.auditLogRepository
      .createQueryBuilder('audit_log')
      .select('audit_log.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('audit_log.status')
      .getRawMany();

    return {
      total,
      byOperation,
      byStatus,
    };
  }

  async cleanup(retentionDays: number = 2555): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.auditLogRepository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }

  /**
   * Record a sensitive action to the tamper-evident audit_log table.
   * INSERT-only — UPDATE/DELETE are blocked at the DB level via triggers.
   */
  async log(entry: SensitiveAuditEntry): Promise<SensitiveAuditLog> {
    const record = this.sensitiveRepo.create({
      actorAddress: entry.actorAddress,
      action: entry.action,
      targetAddress: entry.targetAddress ?? null,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      ipAddress: entry.ipAddress ?? null,
      metadata: entry.metadata ?? {},
    });
    return this.sensitiveRepo.save(record);
  }

  /**
   * Paginated query for GET /audit-logs (admin only).
   */
  async findAllSensitive(query: QueryAuditLogsDto): Promise<PaginatedAuditLogs> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.sensitiveRepo.createQueryBuilder('al').orderBy('al.timestamp', 'DESC');

    if (query.actorAddress) {
      qb.andWhere('al.actorAddress = :actorAddress', { actorAddress: query.actorAddress });
    }
    if (query.action) {
      qb.andWhere('al.action = :action', { action: query.action });
    }
    if (query.startDate) {
      qb.andWhere('al.timestamp >= :startDate', { startDate: new Date(query.startDate) });
    }
    if (query.endDate) {
      qb.andWhere('al.timestamp <= :endDate', { endDate: new Date(query.endDate) });
    }

    return PaginationUtil.paginateQueryBuilder(qb, { page, pageSize });
  }
}
