import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TenantContext } from '../../tenant/context/tenant.context';

interface AuthenticatedUser {
  id?: string;
  sub?: string;
  organizationId?: string;
  tenantId?: string;
  role?: string;
  roles?: string[];
  [key: string]: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    let payload: AuthenticatedUser;
    try {
      payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }

    (request as Request & { user?: AuthenticatedUser }).user = payload;

    // Resolve the tenant from the authenticated principal. The client header is
    // only a hint and must match the principal's tenant (SUPER_ADMIN may switch).
    const principalTenantId = payload.organizationId ?? payload.tenantId;
    const headerTenantId = this.extractTenantFromHeader(request);
    const isSuperAdmin =
      payload.role === 'SUPER_ADMIN' ||
      (Array.isArray(payload.roles) && payload.roles.includes('SUPER_ADMIN'));

    if (headerTenantId && !isSuperAdmin && headerTenantId !== principalTenantId) {
      throw new ForbiddenException('Access to the requested tenant is denied');
    }

    const resolvedTenantId = isSuperAdmin
      ? headerTenantId ?? principalTenantId
      : principalTenantId;

    if (resolvedTenantId) {
      this.tenantContext.setTenantId(resolvedTenantId);
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private extractTenantFromHeader(request: Request): string | undefined {
    const header = request.headers['x-tenant-id'];
    if (Array.isArray(header)) {
      return header[0];
    }
    return header;
  }
}
