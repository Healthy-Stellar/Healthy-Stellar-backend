import {
  AuditAction,
  MedicalDepartment,
  MedicalPermission,
  MedicalRole,
  MedicalSpecialty,
} from '../roles/medical-roles.enum';

export interface MedicalUser {
  id: string;
  staffId: string;
  roles: MedicalRole[];
  department: MedicalDepartment;
  specialties?: MedicalSpecialty[];
}

export interface AuditLogEntry {
  userId: string;
  staffId: string;
  action: AuditAction | string;
  resource: string;
  resourceId?: string;
  patientId?: string;
  department?: MedicalDepartment;
  isEmergencyOverride: boolean;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  success: boolean;
  failureReason?: string;
  timestamp: Date;
}

export interface EmergencyOverrideContext {
  userId: string;
  patientId: string;
  reason: string;
  timestamp: Date;
  expiresAt: Date;
}

export interface DepartmentAccessPolicy {
  department: MedicalDepartment;
  allowedRoles: MedicalRole[];
  requiresSpecialty?: MedicalSpecialty[];
}

export type RolePermissionMap = Record<MedicalRole, MedicalPermission[]>;
