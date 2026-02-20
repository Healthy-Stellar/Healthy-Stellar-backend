import { MedicalDepartment, MedicalPermission, MedicalRole, MedicalSpecialty } from '../enums/medical-roles.enum';
import { MedicalUser } from '../interfaces/medical-rbac.interface';
import { MedicalPermissionsService } from '../services/medical-permissions.service';

const makeUser = (overrides: Partial<MedicalUser> = {}): MedicalUser => ({
  id: 'user-1',
  staffId: 'STAFF-001',
  roles: [MedicalRole.NURSE],
  department: MedicalDepartment.GENERAL,
  ...overrides,
});

describe('MedicalPermissionsService', () => {
  let service: MedicalPermissionsService;

  beforeEach(() => {
    service = new MedicalPermissionsService();
  });

  // ─── Role Permission Mapping ─────────────────────────────────────────────

  describe('getPermissionsForRoles', () => {
    it('returns admin permissions for ADMIN role', () => {
      const perms = service.getPermissionsForRoles([MedicalRole.ADMIN]);
      expect(perms).toContain(MedicalPermission.MANAGE_STAFF);
      expect(perms).toContain(MedicalPermission.DELETE_PATIENT_DATA);
      expect(perms).toContain(MedicalPermission.ACCESS_ANY_DEPARTMENT);
      expect(perms).toContain(MedicalPermission.EMERGENCY_OVERRIDE);
    });

    it('returns doctor permissions for DOCTOR role', () => {
      const perms = service.getPermissionsForRoles([MedicalRole.DOCTOR]);
      expect(perms).toContain(MedicalPermission.READ_PATIENT_FULL);
      expect(perms).toContain(MedicalPermission.WRITE_PRESCRIPTIONS);
      expect(perms).toContain(MedicalPermission.EMERGENCY_OVERRIDE);
      expect(perms).not.toContain(MedicalPermission.DELETE_PATIENT_DATA);
      expect(perms).not.toContain(MedicalPermission.MANAGE_STAFF);
    });

    it('returns nurse permissions for NURSE role', () => {
      const perms = service.getPermissionsForRoles([MedicalRole.NURSE]);
      expect(perms).toContain(MedicalPermission.READ_PATIENT_FULL);
      expect(perms).toContain(MedicalPermission.WRITE_MEDICAL_RECORDS);
      expect(perms).not.toContain(MedicalPermission.WRITE_PRESCRIPTIONS);
      expect(perms).not.toContain(MedicalPermission.EMERGENCY_OVERRIDE);
    });

    it('returns pharmacist permissions for PHARMACIST role', () => {
      const perms = service.getPermissionsForRoles([MedicalRole.PHARMACIST]);
      expect(perms).toContain(MedicalPermission.DISPENSE_MEDICATIONS);
      expect(perms).toContain(MedicalPermission.READ_PRESCRIPTIONS);
      expect(perms).not.toContain(MedicalPermission.READ_PATIENT_FULL);
    });

    it('returns lab technician permissions for LAB_TECHNICIAN role', () => {
      const perms = service.getPermissionsForRoles([MedicalRole.LAB_TECHNICIAN]);
      expect(perms).toContain(MedicalPermission.WRITE_LAB_RESULTS);
      expect(perms).not.toContain(MedicalPermission.READ_MEDICAL_RECORDS);
    });

    it('merges permissions for users with multiple roles', () => {
      const perms = service.getPermissionsForRoles([MedicalRole.NURSE, MedicalRole.LAB_TECHNICIAN]);
      expect(perms).toContain(MedicalPermission.WRITE_LAB_RESULTS);
      expect(perms).toContain(MedicalPermission.WRITE_MEDICAL_RECORDS);
    });

    it('deduplicates permissions across roles', () => {
      const perms = service.getPermissionsForRoles([MedicalRole.DOCTOR, MedicalRole.NURSE]);
      const readPatient = perms.filter((p) => p === MedicalPermission.READ_PATIENT_FULL);
      expect(readPatient).toHaveLength(1);
    });

    it('returns empty array for unknown role', () => {
      const perms = service.getPermissionsForRoles(['UNKNOWN' as MedicalRole]);
      expect(perms).toEqual([]);
    });
  });

  // ─── hasPermission ────────────────────────────────────────────────────────

  describe('hasPermission', () => {
    it('returns true when user has required permission', () => {
      const user = makeUser({ roles: [MedicalRole.DOCTOR] });
      expect(service.hasPermission(user, MedicalPermission.EMERGENCY_OVERRIDE)).toBe(true);
    });

    it('returns false when user lacks required permission', () => {
      const user = makeUser({ roles: [MedicalRole.NURSE] });
      expect(service.hasPermission(user, MedicalPermission.EMERGENCY_OVERRIDE)).toBe(false);
    });
  });

  // ─── hasAllPermissions ────────────────────────────────────────────────────

  describe('hasAllPermissions', () => {
    it('returns true when user has all required permissions', () => {
      const user = makeUser({ roles: [MedicalRole.DOCTOR] });
      expect(
        service.hasAllPermissions(user, [
          MedicalPermission.READ_PATIENT_FULL,
          MedicalPermission.WRITE_PRESCRIPTIONS,
        ]),
      ).toBe(true);
    });

    it('returns false when user is missing one permission', () => {
      const user = makeUser({ roles: [MedicalRole.NURSE] });
      expect(
        service.hasAllPermissions(user, [
          MedicalPermission.READ_PATIENT_FULL,
          MedicalPermission.WRITE_PRESCRIPTIONS, // nurses don't have this
        ]),
      ).toBe(false);
    });
  });

  // ─── canAccessDepartment ─────────────────────────────────────────────────

  describe('canAccessDepartment', () => {
    it('admin can access any department', () => {
      const admin = makeUser({ roles: [MedicalRole.ADMIN] });
      expect(service.canAccessDepartment(admin, MedicalDepartment.SURGERY)).toBe(true);
      expect(service.canAccessDepartment(admin, MedicalDepartment.PHARMACY)).toBe(true);
      expect(service.canAccessDepartment(admin, MedicalDepartment.LABORATORY)).toBe(true);
    });

    it('pharmacist can only access pharmacy-related departments', () => {
      const pharmacist = makeUser({
        roles: [MedicalRole.PHARMACIST],
        department: MedicalDepartment.PHARMACY,
      });
      expect(service.canAccessDepartment(pharmacist, MedicalDepartment.PHARMACY)).toBe(true);
      expect(service.canAccessDepartment(pharmacist, MedicalDepartment.SURGERY)).toBe(false);
    });

    it('lab technician can access laboratory department', () => {
      const labTech = makeUser({
        roles: [MedicalRole.LAB_TECHNICIAN],
        department: MedicalDepartment.LABORATORY,
      });
      expect(service.canAccessDepartment(labTech, MedicalDepartment.LABORATORY)).toBe(true);
      expect(service.canAccessDepartment(labTech, MedicalDepartment.CARDIOLOGY)).toBe(false);
    });

    it('doctor in own department can access without specialty restriction', () => {
      const doctor = makeUser({
        roles: [MedicalRole.DOCTOR],
        department: MedicalDepartment.CARDIOLOGY,
        specialties: [],
      });
      expect(service.canAccessDepartment(doctor, MedicalDepartment.CARDIOLOGY)).toBe(true);
    });

    it('doctor with matching specialty can access specialty department', () => {
      const doctor = makeUser({
        roles: [MedicalRole.DOCTOR],
        department: MedicalDepartment.GENERAL,
        specialties: [MedicalSpecialty.CARDIOLOGIST],
      });
      expect(service.canAccessDepartment(doctor, MedicalDepartment.CARDIOLOGY)).toBe(true);
    });

    it('doctor without specialty is denied specialty department if not assigned there', () => {
      const doctor = makeUser({
        roles: [MedicalRole.DOCTOR],
        department: MedicalDepartment.GENERAL,
        specialties: [MedicalSpecialty.GENERAL_PRACTITIONER],
      });
      expect(service.canAccessDepartment(doctor, MedicalDepartment.NEUROLOGY)).toBe(false);
    });

    it('all allowed roles can access emergency department', () => {
      const nurse = makeUser({ roles: [MedicalRole.NURSE] });
      const pharmacist = makeUser({ roles: [MedicalRole.PHARMACIST] });
      const labTech = makeUser({ roles: [MedicalRole.LAB_TECHNICIAN] });

      expect(service.canAccessDepartment(nurse, MedicalDepartment.EMERGENCY)).toBe(true);
      expect(service.canAccessDepartment(pharmacist, MedicalDepartment.EMERGENCY)).toBe(true);
      expect(service.canAccessDepartment(labTech, MedicalDepartment.EMERGENCY)).toBe(true);
    });

    it('returns false for non-existent department policy', () => {
      const nurse = makeUser({ roles: [MedicalRole.NURSE] });
      expect(service.canAccessDepartment(nurse, 'UNKNOWN_DEPT' as MedicalDepartment)).toBe(false);
    });
  });
});
