import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity, AuditAction } from './audit-log.entity';
import { AuditEventDto } from './dto/audit-event.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  /**
   * Log an audit event (medical record access, write, grant, revoke).
   * Saves to audit_logs table. Optionally stores a Stellar tx hash for tamper-evidence.
   */
  async log(event: AuditEventDto): Promise<AuditLogEntity> {
    const entry = this.auditLogRepository.create({
      userId: event.actorId,
      action: event.action,
      resourceId: event.resourceId,
      resourceType: event.resourceType,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      stellarTxHash: event.stellarTxHash ?? null,
      severity: 'LOW',
      entity: event.resourceType ?? 'MedicalRecord',
    });
    return this.auditLogRepository.save(entry);
  }

  /**
   * Log authentication events
   */
  async logAuthenticationEvent(
    action: AuditAction | string,
    success: boolean,
    metadata: {
      userId?: string;
      email?: string;
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
      reason?: string;
      description?: string;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      [key: string]: any;
    },
  ): Promise<AuditLogEntity> {
    const auditAction = typeof action === 'string' ? (action as AuditAction) : action;
    const log = this.auditLogRepository.create({
      userId: metadata.userId || null,
      action: auditAction,
      description: metadata.description || `${auditAction} - ${success ? 'Success' : 'Failed'}`,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: {
        ...metadata,
        success,
      },
      resourceType: 'AUTH',
      severity: metadata.severity || (success ? 'LOW' : 'MEDIUM'),
      requiresInvestigation: !success && auditAction === AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
    });

    return this.auditLogRepository.save(log);
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, any>,
  ): Promise<AuditLogEntity> {
    const log = this.auditLogRepository.create({
      userId,
      action: AuditAction.DATA_ACCESS,
      description: `Accessed ${resourceType} (${resourceId})`,
      ipAddress,
      userAgent,
      resourceId,
      resourceType,
      metadata,
      severity: 'LOW',
    });

    return this.auditLogRepository.save(log);
  }

  /**
   * Log data export event
   */
  async logDataExport(
    userId: string,
    resourceType: string,
    resourceIds: string[],
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, any>,
  ): Promise<AuditLogEntity> {
    const log = this.auditLogRepository.create({
      userId,
      action: AuditAction.DATA_EXPORT,
      description: `Exported ${resourceIds.length} ${resourceType} records`,
      ipAddress,
      userAgent,
      resourceType,
      metadata: {
        ...metadata,
        exportedCount: resourceIds.length,
        resourceIds,
      },
      severity: 'MEDIUM',
    });

    return this.auditLogRepository.save(log);
  }

  /**
   * Log user management events
   */
  async logUserManagement(
    userId: string,
    action: AuditAction,
    targetUserId: string,
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, any>,
  ): Promise<AuditLogEntity> {
    const log = this.auditLogRepository.create({
      userId,
      action,
      description: `${action} for user ${targetUserId}`,
      ipAddress,
      userAgent,
      resourceId: targetUserId,
      resourceType: 'USER',
      metadata,
      severity: 'MEDIUM',
    });

    return this.auditLogRepository.save(log);
  }

  /**
   * Get audit logs for investigation
   */
  async getAuditLogs(
    filters?: {
      userId?: string;
      action?: AuditAction;
      startDate?: Date;
      endDate?: Date;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      requiresInvestigation?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<AuditLogEntity[]> {
    let query = this.auditLogRepository.createQueryBuilder('audit');

    if (filters?.userId) {
      query = query.where('audit.userId = :userId', { userId: filters.userId });
    }

    if (filters?.action) {
      query = query.andWhere('audit.action = :action', { action: filters.action });
    }

    if (filters?.startDate) {
      query = query.andWhere('audit.createdAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      query = query.andWhere('audit.createdAt <= :endDate', { endDate: filters.endDate });
    }

    if (filters?.severity) {
      query = query.andWhere('audit.severity = :severity', { severity: filters.severity });
    }

    if (filters?.requiresInvestigation) {
      query = query.andWhere('audit.requiresInvestigation = :requiresInvestigation', {
        requiresInvestigation: true,
      });
    }

    query = query.orderBy('audit.createdAt', 'DESC');

    if (filters?.limit) {
      query = query.take(filters.limit);
    }

    if (filters?.offset) {
      query = query.skip(filters.offset);
    }

    return query.getMany();
  }

  /**
   * Get high-risk audit events
   */
  async getHighRiskEvents(days: number = 7): Promise<AuditLogEntity[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.createdAt >= :startDate', { startDate })
      .andWhere("audit.severity IN (:...severities)", { severities: ['HIGH', 'CRITICAL'] })
      .orderBy('audit.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Paginated query for GET /audit.
   * Filters by patientId (stored as resourceId or userId) and date range.
   */
  async findAll(params: {
    patientId?: string;
    fromDate?: Date;
    toDate?: Date;
    page: number;
    limit: number;
  }): Promise<{ data: AuditLogEntity[]; total: number; page: number; limit: number }> {
    let query = this.auditLogRepository
      .createQueryBuilder('audit')
      .orderBy('audit.timestamp', 'DESC');

    if (params.patientId) {
      query = query.andWhere('(audit.resourceId = :pid OR audit.userId = :pid)', {
        pid: params.patientId,
      });
    }

    if (params.fromDate) {
      query = query.andWhere('audit.timestamp >= :from', { from: params.fromDate });
    }

    if (params.toDate) {
      query = query.andWhere('audit.timestamp <= :to', { to: params.toDate });
    }

    const total = await query.getCount();
    const data = await query
      .skip((params.page - 1) * params.limit)
      .take(params.limit)
      .getMany();

    return { data, total, page: params.page, limit: params.limit };
  }

  /**
   * Converts audit log rows to a CSV string for GET /audit/export.
   */
  toCsv(rows: AuditLogEntity[]): string {
    const headers = [
      'id',
      'actorId',
      'action',
      'resourceId',
      'resourceType',
      'ipAddress',
      'userAgent',
      'timestamp',
      'stellarTxHash',
    ];

    const escape = (v: unknown): string => {
      const str = v == null ? '' : String(v);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    const lines = rows.map((r) =>
      [
        r.id,
        r.userId,
        r.action,
        r.resourceId,
        r.resourceType,
        r.ipAddress,
        r.userAgent,
        r.timestamp?.toISOString(),
        r.stellarTxHash,
      ]
        .map(escape)
        .join(','),
    );

    return [headers.join(','), ...lines].join('\n');
  }
}
