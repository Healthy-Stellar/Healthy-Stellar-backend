import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../users/entities/patient.entity';
import { UserRole } from '../../auth/entities/user.entity';

/** Shape of `request.user` as populated by JwtAuthGuard (raw access-token payload). */
export interface EmergencyAuthPrincipal {
  userId?: string;
  role?: string;
  organizationId?: string | null;
}

/** Roles treated as clinical staff for emergency medical info access. */
const CLINICAL_ROLES: ReadonlySet<string> = new Set<string>([
  UserRole.ADMIN,
  UserRole.PHYSICIAN,
  UserRole.NURSE,
  UserRole.SURGEON,
]);

/**
 * Resolves the authenticated principal to a patient record and enforces
 * access to a patient's emergency medical info. The caller identity always
 * comes from the `userId` claim and is mapped to a patient through
 * `patients.userId`; user ids and patient ids are never assumed to match.
 */
@Injectable()
export class EmergencyAccessService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
  ) {}

  isClinicalStaff(user: EmergencyAuthPrincipal | undefined): boolean {
    return !!user?.role && CLINICAL_ROLES.has(String(user.role).toLowerCase());
  }

  /** Returns the patient id owned by the authenticated user, or null if none. */
  async resolveCallerPatientId(user: EmergencyAuthPrincipal | undefined): Promise<string | null> {
    if (!user?.userId) return null;
    const patient = await this.patientRepo.findOne({
      where: { userId: user.userId },
      select: ['id'],
    });
    return patient?.id ?? null;
  }

  /**
   * Allow the patient themselves, or clinical staff in the same tenant
   * (organization) as the patient. Throws 403 otherwise.
   */
  async assertPatientAccess(
    user: EmergencyAuthPrincipal | undefined,
    patientId: string,
  ): Promise<void> {
    const callerPatientId = await this.resolveCallerPatientId(user);
    if (callerPatientId && callerPatientId === patientId) return;

    if (this.isClinicalStaff(user) && (await this.isSameTenant(user, patientId))) return;

    throw new ForbiddenException(
      "You are not authorized to access this patient's emergency medical info",
    );
  }

  private async isSameTenant(
    user: EmergencyAuthPrincipal | undefined,
    patientId: string,
  ): Promise<boolean> {
    const callerOrg = user?.organizationId;
    if (!callerOrg) return false;

    const patient = await this.patientRepo.findOne({
      where: { id: patientId },
      relations: ['user'],
    });
    const patientOrg = patient?.user?.organizationId;
    return !!patientOrg && patientOrg === callerOrg;
  }
}
