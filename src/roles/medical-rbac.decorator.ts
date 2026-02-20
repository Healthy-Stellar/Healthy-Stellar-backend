import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { MedicalDepartment, MedicalPermission, MedicalRole, MedicalSpecialty } from '../enums/medical-roles.enum';

export const MEDICAL_ROLES_KEY = 'medicalRoles';
export const MEDICAL_PERMISSIONS_KEY = 'medicalPermissions';
export const MEDICAL_DEPARTMENT_KEY = 'medicalDepartment';
export const MEDICAL_SPECIALTY_KEY = 'medicalSpecialty';
export const EMERGENCY_OVERRIDE_KEY = 'emergencyOverride';
export const AUDIT_RESOURCE_KEY = 'auditResource';

/**
 * Restrict endpoint to specific medical roles.
 * @example @MedicalRoles(MedicalRole.DOCTOR, MedicalRole.NURSE)
 */
export const MedicalRoles = (...roles: MedicalRole[]) =>
  SetMetadata(MEDICAL_ROLES_KEY, roles);

/**
 * Restrict endpoint to users with specific permissions.
 * @example @RequirePermissions(MedicalPermission.READ_PATIENT_FULL)
 */
export const RequirePermissions = (...permissions: MedicalPermission[]) =>
  SetMetadata(MEDICAL_PERMISSIONS_KEY, permissions);

/**
 * Restrict endpoint to users in specific departments.
 * @example @DepartmentAccess(MedicalDepartment.CARDIOLOGY)
 */
export const DepartmentAccess = (...departments: MedicalDepartment[]) =>
  SetMetadata(MEDICAL_DEPARTMENT_KEY, departments);

/**
 * Restrict endpoint to users with specific specialties.
 * @example @SpecialtyRequired(MedicalSpecialty.CARDIOLOGIST)
 */
export const SpecialtyRequired = (...specialties: MedicalSpecialty[]) =>
  SetMetadata(MEDICAL_SPECIALTY_KEY, specialties);

/**
 * Mark endpoint as supporting emergency override access.
 * When set, authenticated emergency override sessions gain access.
 */
export const AllowEmergencyOverride = () =>
  SetMetadata(EMERGENCY_OVERRIDE_KEY, true);

/**
 * Annotate the resource name for audit log entries.
 * @example @AuditResource('patient_record')
 */
export const AuditResource = (resourceName: string) =>
  SetMetadata(AUDIT_RESOURCE_KEY, resourceName);

/**
 * Extract the authenticated medical user from the request.
 */
export const CurrentMedicalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.medicalUser;
  },
);

/**
 * Extract the emergency override context from the request (if active).
 */
export const EmergencyContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.emergencyOverrideContext ?? null;
  },
);
