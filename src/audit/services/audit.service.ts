import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditEventDto, AuditAction, ResourceType } from '../dto/audit-event.dto';
import { QueryAuditDto } from '../dto/query-audit.dto';

export interface PaginatedAuditResult {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private logBuffer: Partial<AuditLog>[] = [];
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 3000; // 3 seconds
  private flushTimer: NodeJS.Timeout;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.startBufferFlush();
  }

  /**
   * Log an audit event - non-blocking with buffered writes
   */
  async log(event: AuditEventDto): Promise<void> {
    try {
      const entry = this.buildAuditEntry(event);

      // Emit event for real-time monitoring
      this.eventEmitter.emit('audit.logged', entry);

      // Buffer the log entry
      this.logBuffer.push(entry);

      // Flush if buffer is full
      if (this.logBuffer.length >= this.BUFFER_SIZE) {
        await this.flushBuffer();
      }

      this.logger.debug(
        `Audit logged: ${event.action} by ${event.actorId} on ${event.resourceType}:${event.resourceId}`,
      );
    } catch (error) {
      this.logger.error('Failed to log audit event', error);
      // Don't throw - audit logging should never break the main flow
    }
  }

  /**
   * Log a record access event (convenience method)
   */
  async logRecordAccess(
    actorId: string,
    action: AuditAction,
    resourceId: string,
    patientId?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.log({
      actorId,
      action,
      resourceId,
      resourceType: ResourceType.RECORD,
      metadata: {
        ...metadata,
        patientId,
      },
    });
  }

  /**
   * Query audit logs with pagination and filtering
   * Only accessible by Admin or the patient themselves
   */
  async query(
    queryDto: QueryAuditDto,
    requestingUserId: string,
    userRole: string,
  ): Promise<PaginatedAuditResult> {
    // Authorization check
    const isAdmin = userRole === 'ADMIN' || userRole === 'SYSTEM_ADMIN';
    const isPatient = userRole === 'PATIENT';

    if (!isAdmin && !isPatient) {
      throw new ForbiddenException('Only admins and patients can query audit logs');
    }

    // Patients can only query their own logs
    if (isPatient && queryDto.patientId !== requestingUserId) {
      throw new ForbiddenException('Patients can only view their own audit logs');
    }

    // Build query
    const where: FindOptionsWhere<AuditLog> = {};

    if (queryDto.patientId) {
      where.patientId = queryDto.patientId;
    }

    if (queryDto.actorId) {
      where.actorId = queryDto.actorId;
    }

    if (queryDto.resourceId) {
      where.resourceId = queryDto.resourceId;
    }

    if (queryDto.action) {
      where.action = queryDto.action;
    }

    if (queryDto.resourceType) {
      where.resourceType = queryDto.resourceType;
    }

    if (queryDto.fromDate && queryDto.toDate) {
      where.createdAt = Between(new Date(queryDto.fromDate), new Date(queryDto.toDate));
    } else if (queryDto.fromDate) {
      where.createdAt = Between(new Date(queryDto.fromDate), new Date());
    }

    const page = queryDto.page || 1;
    const limit = queryDto.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await this.auditLogRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Export audit logs as CSV
   */
  async exportToCsv(queryDto: QueryAuditDto, requestingUserId: string, userRole: string): Promise<string> {
    // Use the same authorization as query
    const result = await this.query(
      { ...queryDto, limit: 10000 }, // Max 10k records for export
      requestingUserId,
      userRole,
    );

    // Build CSV
    const headers = [
      'ID',
      'Actor ID',
      'Action',
      'Resource Type',
      'Resource ID',
      'Patient ID',
      'IP Address',
      'User Agent',
      'Stellar Tx Hash',
      'Timestamp',
      'Metadata',
    ];

    const rows = result.data.map((log) => [
      log.id,
      log.actorId,
      log.action,
      log.resourceType,
      log.resourceId,
      log.patientId || '',
      log.ipAddress || '',
      log.userAgent || '',
      log.stellarTxHash || '',
      log.createdAt.toISOString(),
      JSON.stringify(log.metadata || {}),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Log the export action
    await this.log({
      actorId: requestingUserId,
      action: AuditAction.RECORD_EXPORT,
      resourceId: 'audit-logs',
      resourceType: ResourceType.SYSTEM,
      metadata: {
        exportedRecords: result.data.length,
        filters: queryDto,
      },
    });

    return csvContent;
  }

  /**
   * Get audit statistics for a patient
   */
  async getPatientAuditStats(patientId: string): Promise<Record<string, any>> {
    const stats = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('log.patientId = :patientId', { patientId })
      .groupBy('log.action')
      .getRawMany();

    const totalAccesses = await this.auditLogRepository.count({
      where: { patientId },
    });

    const recentAccesses = await this.auditLogRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      patientId,
      totalAccesses,
      actionBreakdown: stats,
      recentAccesses,
    };
  }

  /**
   * Anchor audit log to Stellar blockchain (optional)
   */
  async anchorToStellar(auditLogId: string, stellarTxHash: string): Promise<void> {
    // Note: This updates the stellarTxHash field
    // The trigger will prevent other updates, but we need to allow this specific update
    // This should be done through a special stored procedure or by temporarily disabling the trigger
    
    try {
      // Use raw query to bypass TypeORM and trigger
      await this.auditLogRepository.query(
        `UPDATE audit_logs SET "stellarTxHash" = $1 WHERE id = $2 AND "stellarTxHash" IS NULL`,
        [stellarTxHash, auditLogId],
      );
      
      this.logger.log(`Audit log ${auditLogId} anchored to Stellar: ${stellarTxHash}`);
    } catch (error) {
      this.logger.error(`Failed to anchor audit log ${auditLogId} to Stellar`, error);
      throw error;
    }
  }

  /**
   * Verify integrity of an audit log entry
   */
  verifyIntegrity(log: AuditLog): boolean {
    const dataString = JSON.stringify({
      actorId: log.actorId,
      action: log.action,
      resourceId: log.resourceId,
      resourceType: log.resourceType,
      timestamp: log.createdAt.toISOString(),
    });

    const computedHash = this.createIntegrityHash(dataString);
    return computedHash === log.integrityHash;
  }

  /**
   * Build audit entry with integrity hash
   */
  private buildAuditEntry(event: AuditEventDto): Partial<AuditLog> {
    const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();

    const dataString = JSON.stringify({
      actorId: event.actorId,
      action: event.action,
      resourceId: event.resourceId,
      resourceType: event.resourceType,
      timestamp: timestamp.toISOString(),
    });

    return {
      actorId: event.actorId,
      action: event.action,
      resourceId: event.resourceId,
      resourceType: event.resourceType,
      patientId: event.metadata?.patientId || null,
      ipAddress: event.ipAddress || null,
      userAgent: event.userAgent || null,
      stellarTxHash: event.stellarTxHash || null,
      metadata: event.metadata || null,
      integrityHash: this.createIntegrityHash(dataString),
      createdAt: timestamp,
    };
  }

  /**
   * Create integrity hash for tamper detection
   */
  private createIntegrityHash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Flush buffered logs to database
   */
  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const toFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await this.auditLogRepository.save(toFlush);
      this.logger.debug(`Flushed ${toFlush.length} audit logs to database`);
    } catch (error) {
      this.logger.error(`Failed to flush ${toFlush.length} audit logs`, error);
      // Re-add to buffer on failure (up to a limit)
      if (this.logBuffer.length < 1000) {
        this.logBuffer.unshift(...toFlush);
      }
    }
  }

  /**
   * Start periodic buffer flush
   */
  private startBufferFlush(): void {
    this.flushTimer = setInterval(() => {
      void this.flushBuffer();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushBuffer();
  }
}
