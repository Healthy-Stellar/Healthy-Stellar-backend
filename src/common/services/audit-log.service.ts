import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

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

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
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
}
