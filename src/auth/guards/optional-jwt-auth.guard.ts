import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthTokenService } from '../services/auth-token.service';
import { SessionManagementService } from '../services/session-management.service';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private authTokenService: AuthTokenService,
    private sessionManagementService: SessionManagementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      return true;
    }

    const payload = this.authTokenService.verifyAccessToken(token);
    if (!payload) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const isSessionValid = await this.sessionManagementService.isSessionValid(payload.sessionId);
    if (!isSessionValid) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    await this.sessionManagementService.updateSessionActivity(payload.sessionId);

    request.user = payload;
    request.sessionId = payload.sessionId;
    return true;
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
