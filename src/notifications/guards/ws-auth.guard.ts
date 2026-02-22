import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthTokenService } from '../../auth/services/auth-token.service';
import { SessionManagementService } from '../../auth/services/session-management.service';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(
    private authTokenService: AuthTokenService,
    private sessionManagementService: SessionManagementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException('Unauthorized');
    }

    try {
      const payload = this.authTokenService.verifyAccessToken(token);
      if (!payload) {
        throw new WsException('Invalid token');
      }

      const isSessionValid = await this.sessionManagementService.isSessionValid(payload.sessionId);
      if (!isSessionValid) {
        throw new WsException('Session expired');
      }

      client.data.user = payload;
      return true;
    } catch {
      throw new WsException('Unauthorized');
    }
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth?.token || client.handshake.headers?.authorization;
    if (!auth) return undefined;
    return auth.startsWith('Bearer ') ? auth.substring(7) : auth;
  }
}
