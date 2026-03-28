import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AuditLog, AuditAction, AuditSeverity } from './audit-log.entity';
import { EncryptionService } from './encryption.service';

/**
 * Actions that require durable persistence under HIPAA.
 * PHI access and authentication events must never be lost on process crash.
 */
const DURABLE_ACTIONS = new Set<AuditAction>([
  AuditAction.PHI_ACCESS,
  AuditAction.PHI_CREATE,
  AuditAction.PHI_UPDATE,
  AuditAction.PHI_DELETE,
  AuditAction.PHI_EXPORT,
  AuditAction.PHI_PRINT,
  AuditAction.LOGIN_SUCCESS,
  AuditAction.LOGIN_FAILURE,
  AuditAction.LOGOUT,
  AuditAction.MFA_SUCCESS,
  AuditAction.MFA_FAILURE,
  AuditAction.PASSWORD_CHANGE,
]);

const WAL_KEY = 'audit:wal';
const WAL_FLUSH_BATCH = 50;
const WAL_FLUSH_INTERVAL = 5000; // 5 seconds

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
export class AuditService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(AuditService.name);
  private redis: Redis;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly encryptionService: EncryptionService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      db: this.configService.get<number>('REDIS_DB', 0),
      lazyConnect: true,
    });

    this.redis.on('error', (err: Error) => {
      this.logger.error('Redis connection error in AuditService WAL', err);
    });

    this.startWalFlushWorker();
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutdown signal received (${signal ?? 'unknown'}). Flushing audit WAL...`);

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flushWal();
    this.redis.disconnect();
    this.logger.log('Audit WAL flushed and Redis disconnected.');
  }

  /**
   * Log a HIPAA audit event.
   * - CRITICAL/EMERGENCY: persisted directly to DB immediately.
   * - All other events (including PHI_ACCESS and AUTHENTICATION): written to Redis WAL
   *   for crash-safe durability, then flushed to PostgreSQL by the background worker.
   */
  async log(options: AuditLogOptions): Promise<void> {
    const entry = this.buildAuditEntry(options);

    this.eventEmitter.emit('audit.logged', entry);

    const isCritical =
      options.severity === AuditSeverity.CRITICAL ||
      options.severity === AuditSeverity.EMERGENCY;

    if (isCritical) {
      await this.persistAuditLog(entry);
      return;
    }

    // PHI_ACCESS, AUTHENTICATION, and all other non-critical events go through WAL
    await this.writeToWal(entry);
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
      this.logger.warn(
        `Anomaly detected for user ${userId}: ${count} PHI accesses in ${windowMinutes}min`,
      );
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

  /**
   * Write an audit entry to the Redis WAL list (RPUSH).
   * Redis is the primary durable store — entries survive process crashes
   * and are flushed to PostgreSQL by the background worker.
   */
  async writeToWal(entry: Partial<AuditLog>): Promise<void> {
    try {
      await this.redis.rpush(WAL_KEY, JSON.stringify(entry));
    } catch (error) {
      this.logger.error('Failed to write audit entry to Redis WAL, persisting directly', error);
      await this.persistAuditLog(entry);
    }
  }

  /**
   * Flush WAL entries from Redis to PostgreSQL in batches.
   * Reads a batch, saves to DB, then trims the consumed entries from the list.
   */
  async flushWal(): Promise<void> {
    try {
      const raw = await this.redis.lrange(WAL_KEY, 0, WAL_FLUSH_BATCH - 1);
      if (raw.length === 0) return;

      const entries: Partial<AuditLog>[] = raw.map((r) => JSON.parse(r) as Partial<AuditLog>);

      await this.auditLogRepository.save(entries);

      // Remove only the entries we just flushed
      await this.redis.ltrim(WAL_KEY, raw.length, -1);

      this.logger.debug(`Flushed ${entries.length} audit entries from WAL to DB`);
    } catch (error) {
      this.logger.error('Failed to flush audit WAL to database', error);
    }
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

  private startWalFlushWorker(): void {
    this.flushTimer = setInterval(() => {
      void this.flushWal();
    }, WAL_FLUSH_INTERVAL);
  }
}
