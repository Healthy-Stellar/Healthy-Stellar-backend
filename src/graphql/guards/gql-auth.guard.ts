import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';
import { AuthTokenService } from '../../auth/services/auth-token.service';
import { SessionManagementService } from '../../auth/services/session-management.service';

export const ROLES_KEY = 'gql_roles';
export const GqlRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Alias used by query/mutation resolvers migrated from graphql-queries
export const Roles = GqlRoles;

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  GqlExecutionContext.create(ctx).getContext().req?.user,
);

@Injectable()
export class GqlAuthGuard implements CanActivate {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly sessionManagementService: SessionManagementService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const gqlCtx = GqlExecutionContext.create(ctx);
    const req = gqlCtx.getContext().req;
    const auth: string | undefined = req?.headers?.authorization;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Missing token');

    const payload = this.authTokenService.verifyAccessToken(auth.slice(7));
    if (!payload) throw new UnauthorizedException('Invalid or expired token');

    const isValid = await this.sessionManagementService.isSessionValid(payload.sessionId);
    if (!isValid) throw new UnauthorizedException('Session expired or revoked');

    req.user = payload;
    return true;
  }
}

@Injectable()
export class GqlRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = GqlExecutionContext.create(ctx).getContext().req?.user;
    if (!user) throw new UnauthorizedException();
    if (!roles.includes(user.role)) throw new ForbiddenException(`Requires role: ${roles.join(', ')}`);
    return true;
  }
}
