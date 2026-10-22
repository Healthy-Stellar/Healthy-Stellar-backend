import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { MedicalUser } from '../interfaces/medical-user.interface';
import { MEDICAL_ROLES_KEY } from '../decorators/medical-roles.decorator';
import { MedicalRole } from '../enums/medical-role.enum';

/**
 * Guard that enforces role-based access control for medical endpoints.
 *
 * The authenticated medical user is expected to be attached to the request
 * (e.g. by an upstream authentication guard/middleware) as `request.medicalUser`.
 * If it is not present, this guard attempts to hydrate it from the standard
 * `request.user` payload so that routes guarded solely by this guard remain
 * reachable for legitimate users carrying a valid JWT.
 */
@Injectable()
export class MedicalRbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const user: MedicalUser =
      (request as any).medicalUser ?? (request as any).user;

    if (!user) {
      throw new UnauthorizedException('No authenticated medical user found');
    }

    // Ensure downstream consumers (e.g. @CurrentMedicalUser) can read it.
    (request as any).medicalUser = user;

    const requiredRoles = this.reflector.getAllAndOverride<MedicalRole[]>(
      MEDICAL_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const userRoles: MedicalRole[] = (user as any).roles ?? [];

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new UnauthorizedException(
        'Insufficient medical role to access this resource',
      );
    }

    return true;
  }
}
