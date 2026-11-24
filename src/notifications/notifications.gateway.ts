import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { OnModuleDestroy, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { WsJwtMiddleware } from './middleware/ws-jwt.middleware';
import { NotificationEvent } from './interfaces/notification-event.interface';
import { NotificationQueueService } from './services/notification-queue.service';
import { SessionRevocationService } from '../auth/services/session-management.service';

/**
 * Parse the shared ALLOWED_ORIGINS allowlist used by HTTP CORS.
 * Never falls back to a wildcard (Issue #1375).
 */
export function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

@WebSocketGateway({
  cors: { origin: getAllowedOrigins(), credentials: true },
  namespace: '/notifications',
})
@UseGuards(WsAuthGuard)
export class NotificationsGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  /** Expiry timers keyed by socket id (Issue #1375). */
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  private readonly onSessionRevoked = (payload: {
    sessionId?: string;
    userId?: string;
  }) => this.disconnectRevokedSockets(payload);

  constructor(
    private readonly queueService: NotificationQueueService,
    private readonly wsJwtMiddleware: WsJwtMiddleware,
    private readonly sessionRevocationService: SessionRevocationService,
  ) {}

  /**
   * Register the JWT handshake middleware so connections are rejected at the
   * transport level before any event is emitted (Issue #640).
   */
  afterInit(server: Server) {
    server.use(this.wsJwtMiddleware.build());
    this.sessionRevocationService.onRevoked(this.onSessionRevoked);
  }

  onModuleDestroy() {
    this.sessionRevocationService.offRevoked(this.onSessionRevoked);
    for (const timer of this.expiryTimers.values()) {
      clearTimeout(timer);
    }
    this.expiryTimers.clear();
  }

  async handleConnection(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.userId;
    if (!userId) {
      client.disconnect();
      return;
    }

    await client.join(userId);

    this.scheduleExpiryDisconnect(client);

    const queuedEvents = await this.queueService.getQueuedEvents(userId);
    if (queuedEvents.length > 0) {
      client.emit('queued.events', queuedEvents);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const timer = this.expiryTimers.get(client.id);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(client.id);
    }

    const userId = client.data.user?.userId;
    if (userId) {
      client.leave(userId);
    }
  }

  /**
   * Disconnect a socket when its JWT expires so no PHI is delivered after
   * the token lifetime (Issue #1375).
   */
  private scheduleExpiryDisconnect(client: Socket) {
    const exp = client.data.user?.exp;
    if (typeof exp !== 'number') {
      return;
    }

    const existing = this.expiryTimers.get(client.id);
    if (existing) {
      clearTimeout(existing);
    }

    const delay = Math.max(0, exp * 1000 - Date.now());
    const timer = setTimeout(() => {
      this.expiryTimers.delete(client.id);
      client.disconnect(true);
    }, delay);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    this.expiryTimers.set(client.id, timer);
  }

  /**
   * Disconnect sockets belonging to a revoked session or user (Issue #1375).
   */
  private disconnectRevokedSockets(payload: {
    sessionId?: string;
    userId?: string;
  }) {
    if (!this.server) {
      return;
    }

    for (const client of this.server.sockets.sockets.values()) {
      const sessionId = client.data.user?.sessionId;
      const userId = client.data.user?.userId;
      const matchesSession =
        !!payload.sessionId && sessionId === payload.sessionId;
      const matchesUser = !!payload.userId && userId === payload.userId;

      if (matchesSession || matchesUser) {
        client.disconnect(true);
      }
    }
  }

  @SubscribeMessage('ping')
  handlePing(): string {
    return 'pong';
  }

  emitNotification(event: NotificationEvent): void {
    const targetUserId = event.metadata?.targetUserId || event.resourceId;
    const connected = this.server.sockets.adapter.rooms.get(targetUserId);

    if (connected?.size) {
      this.server.to(targetUserId).emit(event.eventType, event);
    } else {
      this.queueService.queueEvent(targetUserId, event);
    }
  }
}
