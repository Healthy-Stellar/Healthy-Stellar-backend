import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditLog, AuditAction, AuditSeverity } from '../entities/audit-log.entity';
import { EncryptionService } from '../encryption/encryption.service';

export interface AuditLogOptions {
  userId?: string;
  userRole?: string;
  patientId?: string;
  action: AuditAction;
  severity?: AuditSeverity;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
  requestMethod?: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  deviceId?: string;
  correlationId?: string;
}

export interface AuditQueryOptions {
  userId?: string;
  patientId?: string;
  action?: AuditAction;
  severity?: AuditSeverity;
  startDate?: Date;
  endDate?: Date;
  isAnomaly?: boolean;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private logBuffer: Partial<AuditLog>[] = [];
  private readonly BUFFER_SIZE = 50;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly encryptionService: EncryptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.startBufferFlush();
  }

  /**
   * Log a HIPAA audit event - non-blocking with buffered writes
   */
  async log(options: AuditLogOptions): Promise<void> {
    const entry = this.buildAuditEntry(options);

    // Emit event for real-time monitoring
    this.eventEmitter.emit('audit.logged', entry);

    // Immediately persist critical events; buffer the rest
    if (
      options.severity === AuditSeverity.CRITICAL ||
      options.severity === AuditSeverity.EMERGENCY
    ) {
      await this.persistAuditLog(entry);
    } else {
      this.logBuffer.push(entry);
      if (this.logBuffer.length >= this.BUFFER_SIZE) {
        await this.flushBuffer();
      }
    }
  }

  /**
   * Log PHI access events specifically (most common HIPAA audit requirement)
   */
  async logPhiAccess(
    userId: string,
    patientId: string,
    resource: string,
    action: AuditAction,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      userId,
      patientId,
      action,
      severity: AuditSeverity.INFO,
      resource,
      metadata,
    });
  }

  /**
   * Log security violation (triggers immediate alert)
   */
  async logSecurityViolation(
    details: Omit<AuditLogOptions, 'action' | 'severity'>,
    reason: string,
  ): Promise<void> {
    await this.log({
      ...details,
      action: AuditAction.SECURITY_VIOLATION,
      severity: AuditSeverity.CRITICAL,
      metadata: { ...details.metadata, violationReason: reason },
    });

    this.eventEmitter.emit('security.violation', { details, reason });
  }

  /**
   * Query audit logs for HIPAA compliance reports
   */
  async query(options: AuditQueryOptions): Promise<{ records: AuditLog[]; total: number }> {
    const where: FindOptionsWhere<AuditLog> = {};

    if (options.userId) where.userId = options.userId;
    if (options.action) where.action = options.action;
    if (options.severity) where.severity = options.severity;
    if (options.isAnomaly !== undefined) where.isAnomaly = options.isAnomaly;

    if (options.patientId) {
      where.patientIdHash = this.encryptionService.hashIdentifier(options.patientId);
    }

    if (options.startDate && options.endDate) {
      where.createdAt = Between(options.startDate, options.endDate);
    }

    const [records, total] = await this.auditLogRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: options.limit || 100,
      skip: options.offset || 0,
    });

    return { records, total };
  }

  /**
   * Detect anomalies in audit patterns (e.g., bulk PHI access)
   */
  async detectAnomalies(userId: string, windowMinutes = 60): Promise<boolean> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    const count = await this.auditLogRepository.count({
      where: {
        userId,
        action: AuditAction.PHI_ACCESS,
        createdAt: Between(since, new Date()),
      },
    });

    const ANOMALY_THRESHOLD = 100;
    const isAnomaly = count > ANOMALY_THRESHOLD;

    if (isAnomaly) {
      this.logger.warn(`Anomaly detected for user ${userId}: ${count} PHI accesses in ${windowMinutes}min`);
      this.eventEmitter.emit('audit.anomaly', { userId, count, windowMinutes });
    }

    return isAnomaly;
  }

  /**
   * Generate HIPAA Activity Report for a date range
   */
  async generateActivityReport(startDate: Date, endDate: Date): Promise<Record<string, unknown>> {
    const records = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .addSelect('log.severity', 'severity')
      .where('log.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .groupBy('log.action')
      .addGroupBy('log.severity')
      .getRawMany();

    const violations = await this.auditLogRepository.count({
      where: {
        action: AuditAction.SECURITY_VIOLATION,
        createdAt: Between(startDate, endDate),
      },
    });

    const anomalies = await this.auditLogRepository.count({
      where: {
        isAnomaly: true,
        createdAt: Between(startDate, endDate),
      },
    });

    return {
      period: { startDate, endDate },
      summary: records,
      violations,
      anomalies,
      generatedAt: new Date(),
    };
  }

  private buildAuditEntry(options: AuditLogOptions): Partial<AuditLog> {
    const dataString = JSON.stringify({
      userId: options.userId,
      action: options.action,
      resource: options.resource,
      timestamp: new Date().toISOString(),
    });

    return {
      userId: options.userId || null,
      userRoleSnapshot: options.userRole || null,
      patientIdHash: options.patientId
        ? this.encryptionService.hashIdentifier(options.patientId)
        : null,
      action: options.action,
      severity: options.severity || AuditSeverity.INFO,
      resource: options.resource,
      resourceId: options.resourceId || null,
      ipAddress: options.ipAddress || null,
      userAgent: options.userAgent || null,
      requestPath: options.requestPath || null,
      requestMethod: options.requestMethod || null,
      metadata: options.metadata || null,
      sessionId: options.sessionId || null,
      deviceId: options.deviceId || null,
      correlationId: options.correlationId || null,
      isAnomaly: false,
      integrityHash: this.encryptionService.createIntegritySignature(dataString),
    };
  }

  private async persistAuditLog(entry: Partial<AuditLog>): Promise<void> {
    try {
      await this.auditLogRepository.save(entry);
    } catch (error) {
      this.logger.error('Failed to persist audit log', error);
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const toFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await this.auditLogRepository.save(toFlush);
    } catch (error) {
      this.logger.error(`Failed to flush ${toFlush.length} audit logs`, error);
      // Re-add to buffer on failure (up to a limit to avoid memory issues)
      if (this.logBuffer.length < 500) {
        this.logBuffer.unshift(...toFlush);
      }
    }
  }

  private startBufferFlush(): void {
    setInterval(() => {
      void this.flushBuffer();
    }, this.FLUSH_INTERVAL);
  }
}
