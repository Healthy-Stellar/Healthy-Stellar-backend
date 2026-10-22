import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { WsJwtMiddleware } from './middleware/ws-jwt.middleware';
import { NotificationEvent } from './interfaces/notification-event.interface';
import { NotificationQueueService } from './services/notification-queue.service';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN || '*', credentials: true },
  namespace: '/notifications',
})
@UseGuards(WsAuthGuard)
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly queueService: NotificationQueueService,
    private readonly wsJwtMiddleware: WsJwtMiddleware,
  ) {}

  /**
   * Register the JWT handshake middleware so connections are rejected at the
   * transport level before any event is emitted (Issue #640).
   */
  afterInit(server: Server) {
    server.use(this.wsJwtMiddleware.build());
  }

  async handleConnection(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.userId;
    if (!userId) {
      client.disconnect();
      return;
    }

    await client.join(userId);

    const queuedEvents = await this.queueService.getQueuedEvents(userId);
    if (queuedEvents.length > 0) {
      client.emit('queued.events', queuedEvents);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.userId;
    if (userId) {
      client.leave(userId);
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
