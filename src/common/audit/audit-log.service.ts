import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './audit-log.entity';

export interface AuditLogEntry {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details: any;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp?: Date;
  ipAddress?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private auditLogRepository: Repository<AuditLogEntity>
  ) {}

  async log(entry: AuditLogEntry): Promise<AuditLogEntity> {
    const payload: Partial<AuditLogEntity> = {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      details: entry.details,
      severity: entry.severity,
      timestamp: entry.timestamp || new Date(),
      ipAddress: entry.ipAddress
    };
    const auditLog = this.auditLogRepository.create(payload);

    return this.auditLogRepository.save(auditLog);
  }

  async logValidationFailure(data: any): Promise<void> {
    await this.log({
      action: 'VALIDATION_FAILURE',
      entity: 'MedicalData',
      details: data,
      severity: 'MEDIUM'
    });
  }

  async logUnauthorizedAccess(data: any): Promise<void> {
    await this.log({
      action: 'UNAUTHORIZED_ACCESS',
      entity: 'AccessControl',
      details: data,
      severity: 'HIGH'
    });
  }

  async logForbiddenAccess(data: any): Promise<void> {
    await this.log({
      action: 'FORBIDDEN_ACCESS',
      entity: 'AccessControl',
      details: data,
      severity: 'HIGH'
    });
  }

  async logMedicalRecordError(data: any): Promise<void> {
    await this.log({
      action: 'MEDICAL_RECORD_ERROR',
      entity: 'MedicalRecord',
      details: data,
      severity: 'HIGH'
    });
  }

  async logDatabaseError(data: any): Promise<void> {
    await this.log({
      action: 'DATABASE_ERROR',
      entity: 'Database',
      details: data,
      severity: 'CRITICAL'
    });
  }

  async logEmergencyAlert(data: any): Promise<void> {
    await this.log({
      action: 'EMERGENCY_ALERT',
      entity: 'Patient',
      details: data,
      severity: 'CRITICAL'
    });
  }

  async getAuditLogs(filters?: {
    action?: string;
    entity?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AuditLogEntity[]> {
    const query = this.auditLogRepository.createQueryBuilder('audit');

    if (filters?.action) {
      query.andWhere('audit.action = :action', { action: filters.action });
    }

    if (filters?.entity) {
      query.andWhere('audit.entity = :entity', { entity: filters.entity });
    }

    if (filters?.severity) {
      query.andWhere('audit.severity = :severity', { severity: filters.severity });
    }

    if (filters?.startDate) {
      query.andWhere('audit.timestamp >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      query.andWhere('audit.timestamp <= :endDate', { endDate: filters.endDate });
    }

    return query.orderBy('audit.timestamp', 'DESC').getMany();
  }
}
