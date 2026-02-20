import { Injectable } from '@nestjs/common';
import {
  MedicalDepartment,
  MedicalPermission,
  MedicalRole,
  MedicalSpecialty,
} from '../enums/medical-roles.enum';
import { DepartmentAccessPolicy, MedicalUser, RolePermissionMap } from '../interfaces/medical-rbac.interface';

@Injectable()
export class MedicalPermissionsService {
  private readonly rolePermissions: RolePermissionMap = {
    [MedicalRole.ADMIN]: [
      MedicalPermission.READ_PATIENT_BASIC,
      MedicalPermission.READ_PATIENT_FULL,
      MedicalPermission.WRITE_PATIENT_DATA,
      MedicalPermission.DELETE_PATIENT_DATA,
      MedicalPermission.READ_MEDICAL_RECORDS,
      MedicalPermission.WRITE_MEDICAL_RECORDS,
      MedicalPermission.READ_LAB_RESULTS,
      MedicalPermission.WRITE_LAB_RESULTS,
      MedicalPermission.READ_PRESCRIPTIONS,
      MedicalPermission.WRITE_PRESCRIPTIONS,
      MedicalPermission.ACCESS_ANY_DEPARTMENT,
      MedicalPermission.MANAGE_STAFF,
      MedicalPermission.VIEW_AUDIT_LOGS,
      MedicalPermission.MANAGE_SYSTEM,
      MedicalPermission.EMERGENCY_OVERRIDE,
    ],
    [MedicalRole.DOCTOR]: [
      MedicalPermission.READ_PATIENT_BASIC,
      MedicalPermission.READ_PATIENT_FULL,
      MedicalPermission.WRITE_PATIENT_DATA,
      MedicalPermission.READ_MEDICAL_RECORDS,
      MedicalPermission.WRITE_MEDICAL_RECORDS,
      MedicalPermission.READ_LAB_RESULTS,
      MedicalPermission.READ_PRESCRIPTIONS,
      MedicalPermission.WRITE_PRESCRIPTIONS,
      MedicalPermission.ACCESS_OWN_DEPARTMENT,
      MedicalPermission.EMERGENCY_OVERRIDE,
    ],
    [MedicalRole.NURSE]: [
      MedicalPermission.READ_PATIENT_BASIC,
      MedicalPermission.READ_PATIENT_FULL,
      MedicalPermission.WRITE_PATIENT_DATA,
      MedicalPermission.READ_MEDICAL_RECORDS,
      MedicalPermission.WRITE_MEDICAL_RECORDS,
      MedicalPermission.READ_LAB_RESULTS,
      MedicalPermission.READ_PRESCRIPTIONS,
      MedicalPermission.ACCESS_OWN_DEPARTMENT,
    ],
    [MedicalRole.PHARMACIST]: [
      MedicalPermission.READ_PATIENT_BASIC,
      MedicalPermission.READ_PRESCRIPTIONS,
      MedicalPermission.WRITE_PRESCRIPTIONS,
      MedicalPermission.DISPENSE_MEDICATIONS,
      MedicalPermission.ACCESS_OWN_DEPARTMENT,
    ],
    [MedicalRole.LAB_TECHNICIAN]: [
      MedicalPermission.READ_PATIENT_BASIC,
      MedicalPermission.READ_LAB_RESULTS,
      MedicalPermission.WRITE_LAB_RESULTS,
      MedicalPermission.ACCESS_OWN_DEPARTMENT,
    ],
  };

  private readonly departmentPolicies: DepartmentAccessPolicy[] = [
    {
      department: MedicalDepartment.CARDIOLOGY,
      allowedRoles: [MedicalRole.DOCTOR, MedicalRole.NURSE, MedicalRole.ADMIN],
      requiresSpecialty: [MedicalSpecialty.CARDIOLOGIST],
    },
    {
      department: MedicalDepartment.SURGERY,
      allowedRoles: [MedicalRole.DOCTOR, MedicalRole.NURSE, MedicalRole.ADMIN],
      requiresSpecialty: [MedicalSpecialty.SURGEON],
    },
    {
      department: MedicalDepartment.EMERGENCY,
      allowedRoles: [
        MedicalRole.DOCTOR,
        MedicalRole.NURSE,
        MedicalRole.ADMIN,
        MedicalRole.PHARMACIST,
        MedicalRole.LAB_TECHNICIAN,
      ],
    },
    {
      department: MedicalDepartment.PHARMACY,
      allowedRoles: [MedicalRole.PHARMACIST, MedicalRole.ADMIN, MedicalRole.DOCTOR],
    },
    {
      department: MedicalDepartment.LABORATORY,
      allowedRoles: [MedicalRole.LAB_TECHNICIAN, MedicalRole.ADMIN, MedicalRole.DOCTOR],
    },
    {
      department: MedicalDepartment.PEDIATRICS,
      allowedRoles: [MedicalRole.DOCTOR, MedicalRole.NURSE, MedicalRole.ADMIN],
      requiresSpecialty: [MedicalSpecialty.PEDIATRICIAN],
    },
    {
      department: MedicalDepartment.ONCOLOGY,
      allowedRoles: [MedicalRole.DOCTOR, MedicalRole.NURSE, MedicalRole.ADMIN],
      requiresSpecialty: [MedicalSpecialty.ONCOLOGIST],
    },
    {
      department: MedicalDepartment.NEUROLOGY,
      allowedRoles: [MedicalRole.DOCTOR, MedicalRole.NURSE, MedicalRole.ADMIN],
      requiresSpecialty: [MedicalSpecialty.NEUROLOGIST],
    },
    {
      department: MedicalDepartment.RADIOLOGY,
      allowedRoles: [MedicalRole.DOCTOR, MedicalRole.ADMIN],
      requiresSpecialty: [MedicalSpecialty.RADIOLOGIST],
    },
    {
      department: MedicalDepartment.GENERAL,
      allowedRoles: [
        MedicalRole.DOCTOR,
        MedicalRole.NURSE,
        MedicalRole.ADMIN,
        MedicalRole.PHARMACIST,
        MedicalRole.LAB_TECHNICIAN,
      ],
    },
  ];

  getPermissionsForRoles(roles: MedicalRole[]): MedicalPermission[] {
    const permissionSet = new Set<MedicalPermission>();
    for (const role of roles) {
      const permissions = this.rolePermissions[role] ?? [];
      permissions.forEach((p) => permissionSet.add(p));
    }
    return Array.from(permissionSet);
  }

  hasPermission(user: MedicalUser, permission: MedicalPermission): boolean {
    const userPermissions = this.getPermissionsForRoles(user.roles);
    return userPermissions.includes(permission);
  }

  hasAllPermissions(user: MedicalUser, permissions: MedicalPermission[]): boolean {
    return permissions.every((p) => this.hasPermission(user, p));
  }

  canAccessDepartment(user: MedicalUser, targetDepartment: MedicalDepartment): boolean {
    // Admin with ACCESS_ANY_DEPARTMENT bypasses department restrictions
    if (this.hasPermission(user, MedicalPermission.ACCESS_ANY_DEPARTMENT)) {
      return true;
    }

    // Emergency department is always accessible to all staff for emergencies
    if (targetDepartment === MedicalDepartment.EMERGENCY) {
      return user.roles.some((r) =>
        this.departmentPolicies
          .find((p) => p.department === MedicalDepartment.EMERGENCY)
          ?.allowedRoles.includes(r),
      );
    }

    const policy = this.departmentPolicies.find((p) => p.department === targetDepartment);
    if (!policy) return false;

    const hasRequiredRole = user.roles.some((r) => policy.allowedRoles.includes(r));
    if (!hasRequiredRole) return false;

    // If specialty is required and user is a doctor, check specialty
    if (policy.requiresSpecialty?.length && user.roles.includes(MedicalRole.DOCTOR)) {
      const hasSpecialty = user.specialties?.some((s) =>
        policy.requiresSpecialty!.includes(s),
      );
      // Allow if user is in own department (assigned there)
      return hasSpecialty === true || user.department === targetDepartment;
    }

    return true;
  }

  getDepartmentPolicy(department: MedicalDepartment): DepartmentAccessPolicy | undefined {
    return this.departmentPolicies.find((p) => p.department === department);
  }

  getRolePermissions(role: MedicalRole): MedicalPermission[] {
    return this.rolePermissions[role] ?? [];
  }
}
