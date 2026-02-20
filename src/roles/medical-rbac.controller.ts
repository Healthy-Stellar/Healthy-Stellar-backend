import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AllowEmergencyOverride,
  AuditResource,
  CurrentMedicalUser,
  DepartmentAccess,
  MedicalRoles,
  RequirePermissions,
} from '../decorators/medical-rbac.decorator';
import {
  EmergencyOverrideRequestDto,
  QueryAuditLogsDto,
  ReviewEmergencyOverrideDto,
} from '../dto/medical-rbac.dto';
import { MedicalDepartment, MedicalPermission, MedicalRole } from '../enums/medical-roles.enum';
import { MedicalRbacGuard } from '../guards/medical-rbac.guard';
import { MedicalUser } from '../interfaces/medical-rbac.interface';
import { EmergencyOverrideService } from '../services/emergency-override.service';
import { MedicalAuditService } from '../services/medical-audit.service';
import { MedicalPermissionsService } from '../services/medical-permissions.service';

@Controller('medical-rbac')
@UseGuards(MedicalRbacGuard)
export class MedicalRbacController {
  constructor(
    private readonly permissionsService: MedicalPermissionsService,
    private readonly auditService: MedicalAuditService,
    private readonly emergencyOverrideService: EmergencyOverrideService,
  ) {}

  // ─── Emergency Override ──────────────────────────────────────────────────────

  @Post('emergency-override')
  @MedicalRoles(MedicalRole.DOCTOR, MedicalRole.ADMIN)
  @RequirePermissions(MedicalPermission.EMERGENCY_OVERRIDE)
  @AuditResource('emergency_override')
  async activateEmergencyOverride(
    @CurrentMedicalUser() user: MedicalUser,
    @Body() dto: EmergencyOverrideRequestDto,
  ) {
    return this.emergencyOverrideService.activateOverride(
      user,
      dto.patientId,
      dto.reason,
    );
  }

  @Get('emergency-override/pending')
  @MedicalRoles(MedicalRole.ADMIN)
  @RequirePermissions(MedicalPermission.VIEW_AUDIT_LOGS)
  @AuditResource('emergency_override_pending')
  async getPendingOverrides() {
    return this.emergencyOverrideService.getPendingReviews();
  }

  @Post('emergency-override/review')
  @MedicalRoles(MedicalRole.ADMIN)
  @RequirePermissions(MedicalPermission.MANAGE_SYSTEM)
  @AuditResource('emergency_override_review')
  async reviewOverride(
    @CurrentMedicalUser() user: MedicalUser,
    @Body() dto: ReviewEmergencyOverrideDto,
  ) {
    return this.emergencyOverrideService.reviewOverride(
      dto.overrideId,
      user.id,
      dto.reviewNotes,
    );
  }

  // ─── Audit Logs ──────────────────────────────────────────────────────────────

  @Get('audit-logs')
  @MedicalRoles(MedicalRole.ADMIN)
  @RequirePermissions(MedicalPermission.VIEW_AUDIT_LOGS)
  @AuditResource('audit_logs')
  async getAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.auditService.queryLogs(query);
  }

  @Get('audit-logs/emergency')
  @MedicalRoles(MedicalRole.ADMIN)
  @RequirePermissions(MedicalPermission.VIEW_AUDIT_LOGS)
  @AuditResource('emergency_audit_logs')
  async getEmergencyAuditLogs() {
    return this.auditService.getEmergencyOverrideLogs();
  }

  @Get('audit-logs/patient/:patientId')
  @MedicalRoles(MedicalRole.DOCTOR, MedicalRole.ADMIN)
  @RequirePermissions(MedicalPermission.READ_PATIENT_FULL)
  @AuditResource('patient_audit_logs')
  @AllowEmergencyOverride()
  async getPatientAuditLogs(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.auditService.getPatientAccessHistory(patientId);
  }

  // ─── Patient Access (Protected) ───────────────────────────────────────────

  @Get('patient/:patientId/records')
  @RequirePermissions(MedicalPermission.READ_MEDICAL_RECORDS)
  @DepartmentAccess(MedicalDepartment.GENERAL)
  @AllowEmergencyOverride()
  @AuditResource('medical_records')
  async getPatientRecords(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentMedicalUser() user: MedicalUser,
  ) {
    // Actual patient data fetching would be delegated to a patient service.
    // This endpoint exists to demonstrate RBAC enforcement.
    return { patientId, accessedBy: user.staffId };
  }

  @Get('patient/:patientId/lab-results')
  @RequirePermissions(MedicalPermission.READ_LAB_RESULTS)
  @DepartmentAccess(MedicalDepartment.LABORATORY, MedicalDepartment.GENERAL)
  @AllowEmergencyOverride()
  @AuditResource('lab_results')
  async getLabResults(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return { patientId, resource: 'lab_results' };
  }

  @Get('patient/:patientId/prescriptions')
  @RequirePermissions(MedicalPermission.READ_PRESCRIPTIONS)
  @DepartmentAccess(MedicalDepartment.PHARMACY, MedicalDepartment.GENERAL)
  @AllowEmergencyOverride()
  @AuditResource('prescriptions')
  async getPrescriptions(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return { patientId, resource: 'prescriptions' };
  }

  // ─── Permissions Introspection ────────────────────────────────────────────

  @Get('my-permissions')
  @AuditResource('permissions_introspection')
  async getMyPermissions(@CurrentMedicalUser() user: MedicalUser) {
    return {
      roles: user.roles,
      department: user.department,
      specialties: user.specialties,
      permissions: this.permissionsService.getPermissionsForRoles(user.roles),
    };
  }
}
