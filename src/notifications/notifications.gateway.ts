import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  SubscribeMessage,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { NotificationEvent } from './interfaces/notification-event.interface';
import { NotificationQueueService } from './services/notification-queue.service';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/notifications',
})
@UseGuards(WsAuthGuard)
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private queueService: NotificationQueueService) {}

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
    
    const connectedClients = this.server.sockets.adapter.rooms.get(targetUserId);
    
    if (connectedClients && connectedClients.size > 0) {
      this.server.to(targetUserId).emit(event.eventType, event);
    } else {
      this.queueService.queueEvent(targetUserId, event);
    }
  }
}
