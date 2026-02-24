import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
  SoftRemoveEvent,
  DataSource,
} from 'typeorm';
import { Injectable, Inject } from '@nestjs/common';
import { BaseAuditEntity } from '../entities/base-audit.entity';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface<BaseAuditEntity> {
  constructor(@Inject('DATA_SOURCE') private dataSource: DataSource) {}

  listenTo() {
    return BaseAuditEntity;
  }

  async afterInsert(event: InsertEvent<BaseAuditEntity>) {
    if (!event.entity) return;

    const userId = this.extractUserId(event);
    const ipAddress = this.extractIpAddress(event);
    const userAgent = this.extractUserAgent(event);

    event.entity.createdBy = userId;
    event.entity.ipAddress = ipAddress;
    event.entity.userAgent = userAgent;

    await this.createAuditLog({
      operation: 'INSERT',
      entityType: event.metadata.tableName,
      entityId: event.entity.id,
      userId,
      ipAddress,
      userAgent,
      newValues: this.sanitizeEntity(event.entity),
      status: 'success',
    });
  }

  async afterUpdate(event: UpdateEvent<BaseAuditEntity>) {
    if (!event.entity) return;

    const userId = this.extractUserId(event);
    const ipAddress = this.extractIpAddress(event);
    const userAgent = this.extractUserAgent(event);

    event.entity.updatedBy = userId;
    event.entity.ipAddress = ipAddress;
    event.entity.userAgent = userAgent;

    await this.createAuditLog({
      operation: 'UPDATE',
      entityType: event.metadata.tableName,
      entityId: event.entity.id,
      userId,
      ipAddress,
      userAgent,
      oldValues: this.sanitizeEntity(event.databaseEntity),
      newValues: this.sanitizeEntity(event.entity),
      changes: this.getChanges(event.databaseEntity, event.entity),
      status: 'success',
    });
  }

  async afterSoftRemove(event: SoftRemoveEvent<BaseAuditEntity>) {
    if (!event.entity) return;

    const userId = this.extractUserId(event);
    const ipAddress = this.extractIpAddress(event);

    event.entity.deletedBy = userId;

    await this.createAuditLog({
      operation: 'SOFT_DELETE',
      entityType: event.metadata.tableName,
      entityId: event.entity.id,
      userId,
      ipAddress,
      oldValues: this.sanitizeEntity(event.entity),
      status: 'success',
    });
  }

  async afterRemove(event: RemoveEvent<BaseAuditEntity>) {
    if (!event.entity) return;

    const userId = this.extractUserId(event);
    const ipAddress = this.extractIpAddress(event);

    await this.createAuditLog({
      operation: 'DELETE',
      entityType: event.metadata.tableName,
      entityId: event.entity.id,
      userId,
      ipAddress,
      oldValues: this.sanitizeEntity(event.entity),
      status: 'success',
    });
  }

  private extractUserId(event: any): string {
    return event.queryRunner?.data?.userId || 'system';
  }

  private extractIpAddress(event: any): string {
    return event.queryRunner?.data?.ipAddress || null;
  }

  private extractUserAgent(event: any): string {
    return event.queryRunner?.data?.userAgent || null;
  }

  private async createAuditLog(data: Partial<AuditLog>): Promise<void> {
    try {
      const auditLogRepository = this.dataSource.getRepository(AuditLog);
      const auditLog = auditLogRepository.create({
        ...data,
        timestamp: new Date(),
      });
      await auditLogRepository.save(auditLog);
    } catch (error) {
      console.error('[AUDIT] Failed to create audit log:', error.message);
    }
  }

  private sanitizeEntity(entity: any): Record<string, any> {
    if (!entity) return null;

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
      'ssn',
      'socialSecurityNumber',
      'pin',
    ];

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(entity)) {
      if (key.startsWith('_') || key === 'constructor') continue;

      if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        sanitized[key] = '***REDACTED***';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private getChanges(oldEntity: any, newEntity: any): Record<string, any> {
    if (!oldEntity || !newEntity) return null;

    const changes: Record<string, any> = {};
    for (const key of Object.keys(newEntity)) {
      if (key.startsWith('_') || key === 'constructor') continue;

      if (JSON.stringify(oldEntity[key]) !== JSON.stringify(newEntity[key])) {
        changes[key] = {
          from: oldEntity[key],
          to: newEntity[key],
        };
      }
    }
    return Object.keys(changes).length > 0 ? changes : null;
  }
}
