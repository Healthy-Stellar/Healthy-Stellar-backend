import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { WsException } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  JoinSessionDto,
  TurnCredentials,
  VideoConferenceService,
} from '../services/Video conference.service';

interface SignalingMessage {
  sessionId: string;
  roomId: string;
  payload: unknown;
}

interface SignalingSocket extends Socket {
  data: {
    sessionId?: string;
    roomId?: string;
    participantId?: string;
    participantType?: JoinSessionDto['participantType'];
  };
}

@WebSocketGateway({
  namespace: '/telemedicine',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
})
export class TelemedicineSignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly videoConferenceService: VideoConferenceService) {}

  async handleConnection(client: SignalingSocket): Promise<void> {
    const { sessionId, sessionToken } = client.handshake.auth || {};

    try {
      const session = await this.videoConferenceService.authenticateSignalingSession(
        sessionId,
        sessionToken,
      );
      client.data.sessionId = session.id;
      client.data.roomId = session.roomId;
      await client.join(session.roomId);
      await this.logConnectionState(client, 'connected');
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: SignalingSocket): Promise<void> {
    await this.logConnectionState(client, 'disconnected');
  }

  @SubscribeMessage('join')
  async join(
    @ConnectedSocket() client: SignalingSocket,
    @MessageBody() body: JoinSessionDto,
  ): Promise<TurnCredentials> {
    this.requireSession(client, body.sessionId);

    await this.videoConferenceService.joinSession(body);
    client.data.participantId = body.participantId;
    client.data.participantType = body.participantType;
    await this.logConnectionState(client, 'joined');

    return this.videoConferenceService.issueTurnCredentials(body.participantId);
  }

  @SubscribeMessage('offer')
  relayOffer(@ConnectedSocket() client: SignalingSocket, @MessageBody() message: SignalingMessage) {
    return this.relay(client, 'offer', message);
  }

  @SubscribeMessage('answer')
  relayAnswer(
    @ConnectedSocket() client: SignalingSocket,
    @MessageBody() message: SignalingMessage,
  ) {
    return this.relay(client, 'answer', message);
  }

  @SubscribeMessage('ice-candidate')
  relayIceCandidate(
    @ConnectedSocket() client: SignalingSocket,
    @MessageBody() message: SignalingMessage,
  ) {
    return this.relay(client, 'ice-candidate', message);
  }

  @SubscribeMessage('connection-state')
  async connectionState(
    @ConnectedSocket() client: SignalingSocket,
    @MessageBody() message: SignalingMessage & { state: string },
  ) {
    this.requireRoom(client, message);
    await this.logConnectionState(client, message.state, message.payload);
    client.to(client.data.roomId).emit('connection-state', message);
    return { acknowledged: true };
  }

  private relay(client: SignalingSocket, event: string, message: SignalingMessage) {
    this.requireRoom(client, message);
    client.to(client.data.roomId).emit(event, {
      ...message,
      participantId: client.data.participantId,
      participantType: client.data.participantType,
    });
    return { relayed: true };
  }

  private requireSession(client: SignalingSocket, sessionId: string): void {
    if (!client.data.sessionId || client.data.sessionId !== sessionId) {
      throw new WsException('Unauthorized signaling session');
    }
  }

  private requireRoom(client: SignalingSocket, message: SignalingMessage): void {
    this.requireSession(client, message.sessionId);
    if (!client.data.roomId || client.data.roomId !== message.roomId) {
      throw new WsException('Invalid signaling room');
    }
    if (!client.data.participantId) {
      throw new WsException('Participant must join first');
    }
  }

  private async logConnectionState(
    client: SignalingSocket,
    state: string,
    details?: unknown,
  ): Promise<void> {
    if (!client.data.sessionId) return;
    await this.videoConferenceService.logTechnicalIssue(client.data.sessionId, {
      event: 'connection-state',
      state,
      participantId: client.data.participantId,
      participantType: client.data.participantType,
      details,
    });
  }
}
