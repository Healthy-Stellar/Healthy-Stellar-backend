import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthTokenService, JwtPayload } from '../services/auth-token.service';
import { SessionManagementService } from '../services/session-management.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ALLOW_MFA_PENDING_KEY } from '../decorators/allow-mfa-pending.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private authTokenService: AuthTokenService,
    private sessionManagementService: SessionManagementService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    const allowMfaPending =
      this.reflector.getAllAndOverride<boolean>(ALLOW_MFA_PENDING_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true;

    try {
      // MFA-pending tokens (password step only) are refused here unless the
      // route is one of the MFA challenge endpoints.
      const payload = this.authTokenService.verifyAccessToken(token, { allowMfaPending });

      if (!payload) {
        throw new UnauthorizedException('Invalid token');
      }

      // Verify session is still active
      const isSessionValid = await this.sessionManagementService.isSessionValid(payload.sessionId);

      if (!isSessionValid) {
        throw new UnauthorizedException('Session expired or revoked');
      }

      // Update session activity
      await this.sessionManagementService.updateSessionActivity(payload.sessionId);

      // Attach user info to request
      request.user = payload;
      request.sessionId = payload.sessionId;

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
