import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GuardianService } from '../services/guardian.service';

/**
 * Allows access if the requesting user is either:
 *  - the patient themselves (id matches :id param), OR
 *  - an active guardian of that patient, OR
 *  - an admin
 */
@Injectable()
export class GuardianAccessGuard implements CanActivate {
  constructor(private readonly guardianService: GuardianService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    if (user.role === 'admin' || user.role === 'registration') return true;

    const patientId: string = req.params.id ?? req.params.patientId ?? req.params.dependentPatientId;
    if (!patientId) return false;

    if (user.id === patientId) return true;

    const isGuardian = await this.guardianService.isActiveGuardian(user.id, patientId);
    if (!isGuardian) throw new ForbiddenException('Access denied: not an active guardian of this patient');
    return true;
  }
}
