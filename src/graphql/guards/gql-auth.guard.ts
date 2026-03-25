import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';
import { AuthTokenService } from '../../auth/services/auth-token.service';
import { SessionManagementService } from '../../auth/services/session-management.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

/**
 * JWT auth guard adapted for GraphQL context.
 * Extracts the token from the Authorization header in the GQL request.
 */
@Injectable()
export class GqlAuthGuard {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly sessionManagementService: SessionManagementService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext<{ req: any }>();

    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('No token provided');

    const payload = this.authTokenService.verifyAccessToken(token);
    if (!payload) throw new UnauthorizedException('Invalid token');

    const isSessionValid = await this.sessionManagementService.isSessionValid(payload.sessionId);
    if (!isSessionValid) throw new UnauthorizedException('Session expired or revoked');

    await this.sessionManagementService.updateSessionActivity(payload.sessionId);
    req.user = payload;

    return true;
  }

  private extractToken(req: any): string | undefined {
    const auth: string = req?.headers?.authorization;
    if (!auth?.startsWith('Bearer ')) return undefined;
    return auth.slice(7);
  }
}
