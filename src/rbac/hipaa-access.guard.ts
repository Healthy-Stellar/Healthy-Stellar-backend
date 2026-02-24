import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditSeverity } from '../entities/audit-log.entity';

export const HIPAA_ROLES_KEY = 'hipaa_roles';
export const MINIMUM_NECESSARY_KEY = 'minimum_necessary';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; permissions?: string[] };
  correlationId?: string;
}

/**
 * HIPAA Access Guard - enforces role-based access to PHI
 */
@Injectable()
export class HipaaAccessGuard implements CanActivate {
  private readonly logger = new Logger(HipaaAccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(HIPAA_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      await this.denyAccess(request, 'No authenticated user');
      throw new ForbiddenException('Authentication required for PHI access');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      await this.denyAccess(request, `Role ${user.role} not authorized`);
      throw new ForbiddenException(
        `Insufficient permissions: requires ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }

  private async denyAccess(req: AuthenticatedRequest, reason: string): Promise<void> {
    await this.auditService.log({
      userId: req.user?.id,
      userRole: req.user?.role,
      action: AuditAction.PERMISSION_DENIED,
      severity: AuditSeverity.WARNING,
      resource: req.path,
      ipAddress: req.ip,
      requestPath: req.path,
      requestMethod: req.method,
      correlationId: req.correlationId,
      metadata: { reason },
    });
  }
}

/**
 * Healthcare Rate Limit Guard
 */
@Injectable()
export class HealthcareRateLimitGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // Rate limiting is handled in middleware
    // This guard can be used for endpoint-specific overrides
    return true;
  }
}

/**
 * Device Auth Guard - validates medical device tokens
 */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  private readonly logger = new Logger(DeviceAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { deviceId?: string }>();
    const deviceToken = request.headers['x-device-token'] as string;
    const deviceId = request.headers['x-device-id'] as string;

    if (!deviceToken || !deviceId) {
      throw new ForbiddenException('Device authentication required');
    }

    // Token validation happens in DeviceAuthService
    // Guard just checks presence; actual validation done by service
    request.deviceId = deviceId;
    return true;
  }
}
