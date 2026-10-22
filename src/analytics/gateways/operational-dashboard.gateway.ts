import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { OperationalDashboardDto } from '../dto/operational-dashboard.dto';

@WebSocketGateway({ namespace: '/analytics/dashboard', cors: { origin: '*' } })
export class OperationalDashboardGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OperationalDashboardGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Dashboard WS client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Dashboard WS client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() tenantId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`tenant:${tenantId}`);
    client.emit('subscribed', { tenantId });
  }

  @OnEvent('operational.dashboard.update')
  handleDashboardUpdate(payload: { tenantId: string; dashboard: OperationalDashboardDto }) {
    this.server
      .to(`tenant:${payload.tenantId}`)
      .emit('dashboard:update', payload.dashboard);
  }
}
