import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindManyOptions, Repository } from 'typeorm';
import { MedicalAuditLog } from '../entities/medical-audit-log.entity';
import { AuditLogEntry } from '../interfaces/medical-rbac.interface';
import { QueryAuditLogsDto } from '../dto/medical-rbac.dto';

@Injectable()
export class MedicalAuditService {
  private readonly logger = new Logger(MedicalAuditService.name);

  constructor(
    @InjectRepository(MedicalAuditLog)
    private readonly auditRepo: Repository<MedicalAuditLog>,
  ) {}

  async log(entry: AuditLogEntry): Promise<MedicalAuditLog> {
    try {
      const auditLog = this.auditRepo.create({
        userId: entry.userId,
        staffId: entry.staffId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        patientId: entry.patientId,
        department: entry.department,
        isEmergencyOverride: entry.isEmergencyOverride,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        metadata: entry.metadata,
        success: entry.success,
        failureReason: entry.failureReason,
      });

      const saved = await this.auditRepo.save(auditLog);

      if (entry.isEmergencyOverride) {
        this.logger.warn(
          `EMERGENCY OVERRIDE: user=${entry.userId} staff=${entry.staffId} ` +
            `patient=${entry.patientId} action=${entry.action}`,
        );
      }

      return saved;
    } catch (error) {
      // Audit failures must never block the main operation, but always log to system
      this.logger.error('Failed to write audit log', { entry, error });
      throw error;
    }
  }

  async logAccessDenied(
    userId: string,
    staffId: string,
    resource: string,
    reason: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId,
      staffId,
      action: 'PERMISSION_DENIED',
      resource,
      isEmergencyOverride: false,
      success: false,
      failureReason: reason,
      ipAddress,
      timestamp: new Date(),
    });
  }

  async queryLogs(query: QueryAuditLogsDto): Promise<{ data: MedicalAuditLog[]; total: number }> {
    const where: FindManyOptions<MedicalAuditLog>['where'] = {};

    if (query.userId) (where as any).userId = query.userId;
    if (query.patientId) (where as any).patientId = query.patientId;
    if (query.department) (where as any).department = query.department;
    if (query.action) (where as any).action = query.action;
    if (query.emergencyOnly) (where as any).isEmergencyOverride = true;

    if (query.startDate && query.endDate) {
      (where as any).timestamp = Between(
        new Date(query.startDate),
        new Date(query.endDate),
      );
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);

    const [data, total] = await this.auditRepo.findAndCount({
      where,
      order: { timestamp: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async getEmergencyOverrideLogs(): Promise<MedicalAuditLog[]> {
    return this.auditRepo.find({
      where: { isEmergencyOverride: true },
      order: { timestamp: 'DESC' },
    });
  }

  async getPatientAccessHistory(patientId: string): Promise<MedicalAuditLog[]> {
    return this.auditRepo.find({
      where: { patientId },
      order: { timestamp: 'DESC' },
    });
  }
}
