import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthTokenService } from '../../auth/services/auth-token.service';
import { SessionManagementService } from '../../auth/services/session-management.service';

/**
 * Socket.io handshake middleware (Issue #640).
 *
 * Validates the JWT **before** the connection is accepted so unauthenticated
 * clients never receive any real-time events.  The decoded payload is attached
 * to `socket.data.user` for downstream use.
 *
 * Token priority: handshake.auth.token → Authorization header (Bearer …)
 */
@Injectable()
export class WsJwtMiddleware {
  constructor(
    private readonly authToken: AuthTokenService,
    private readonly sessionMgr: SessionManagementService,
  ) {}

  /** Returns a Socket.io-compatible `use` middleware function. */
  build() {
    return async (socket: Socket, next: (err?: Error) => void) => {
      try {
        const raw =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization;

        const token = typeof raw === 'string' && raw.startsWith('Bearer ')
          ? raw.slice(7)
          : raw;

        if (!token) {
          socket.emit('error', { status: 401, message: 'Unauthorized' });
          return next(new Error('Unauthorized'));
        }

        const payload = this.authToken.verifyAccessToken(token as string);
        if (!payload) {
          socket.emit('error', { status: 401, message: 'Invalid token' });
          return next(new Error('Invalid token'));
        }

        const valid = await this.sessionMgr.isSessionValid(payload.sessionId);
        if (!valid) {
          socket.emit('error', { status: 401, message: 'Session expired' });
          return next(new Error('Session expired'));
        }

        // Attach decoded user for downstream handlers / guards
        socket.data.user = payload;
        next();
      } catch {
        socket.emit('error', { status: 401, message: 'Unauthorized' });
        next(new Error('Unauthorized'));
      }
    };
  }
}
