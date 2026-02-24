import { Injectable } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class MedicalOperationAuditService {
  constructor(private auditLogService: AuditLogService) {}

  async logMedicalRecordAccess(userId: string, patientId: string, action: string) {
    await this.auditLogService.log({
      userId,
      action: `MEDICAL_RECORD_ACCESS`,
      entity: 'MedicalRecord',
      entityId: patientId,
      details: { action },
      severity: 'MEDIUM',
    });
  }

  async logMedicalRecordModification(userId: string, patientId: string, changes: any) {
    await this.auditLogService.log({
      userId,
      action: 'MEDICAL_RECORD_MODIFIED',
      entity: 'MedicalRecord',
      entityId: patientId,
      details: { changeCount: Object.keys(changes).length },
      severity: 'HIGH',
    });
  }

  async logPrescriptionCreated(userId: string, patientId: string, prescriptionId: string) {
    await this.auditLogService.log({
      userId,
      action: 'PRESCRIPTION_CREATED',
      entity: 'Prescription',
      entityId: prescriptionId,
      details: { patientId },
      severity: 'HIGH',
    });
  }

  async logValidationFailure(userId: string, dataType: string, reason: string) {
    await this.auditLogService.log({
      userId,
      action: 'VALIDATION_FAILED',
      entity: dataType,
      details: { reason },
      severity: 'MEDIUM',
    });
  }

  async logEmergencyAlert(userId: string, patientId: string, alertType: string) {
    await this.auditLogService.log({
      userId,
      action: 'EMERGENCY_ALERT_TRIGGERED',
      entity: 'Patient',
      entityId: patientId,
      details: { alertType },
      severity: 'CRITICAL',
    });
  }
}
