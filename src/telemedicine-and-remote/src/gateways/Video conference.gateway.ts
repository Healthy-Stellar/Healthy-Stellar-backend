import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { VideoConferenceService } from '../services/Video conference.service';

interface SignalingHandshake {
  sessionId?: string;
  sessionToken?: string;
  participantType?: 'patient' | 'provider';
  participantId?: string;
}

interface AuthenticatedSocket extends Socket {
  data: {
    sessionId?: string;
    roomId?: string;
    participantType?: 'patient' | 'provider';
    participantId?: string;
    joined?: boolean;
  };
}

@WebSocketGateway({
  namespace: '/telemedicine',
  cors: { origin: true, credentials: true },
})
export class VideoConferenceGateway {
  @WebSocketServer()
  private server: Server;

  constructor(private readonly videoConferenceService: VideoConferenceService) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const auth = (client.handshake.auth || {}) as SignalingHandshake;

    try {
      if (!auth.sessionId || !auth.sessionToken) {
        throw new WsException('Session credentials are required');
      }

      const session = await this.videoConferenceService.authenticateSignaling(
        auth.sessionId,
        auth.sessionToken,
      );
      client.data.sessionId = session.id;
      client.data.roomId = session.roomId;
      client.data.participantType = auth.participantType;
      client.data.participantId = auth.participantId;

      if (auth.participantType && auth.participantId) {
        await this.videoConferenceService.recordConnectionState(
          session.id,
          auth.participantType,
          'connected',
        );
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    if (!client.data.sessionId || !client.data.participantType) return;

    await this.videoConferenceService.recordConnectionState(
      client.data.sessionId,
      client.data.participantType,
      'disconnected',
    );

    if (client.data.joined) {
      await this.videoConferenceService.leaveSession(
        client.data.sessionId,
        client.data.participantType,
      );
    }
  }

  @SubscribeMessage('join')
  async join(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: { participantType: 'patient' | 'provider'; participantId: string; token: string },
  ) {
    if (!client.data.sessionId || !client.data.roomId) {
      throw new WsException('Unauthenticated socket');
    }
    if (!body?.participantType || !body.participantId || !body.token) {
      throw new WsException('Participant credentials are required');
    }

    const result = await this.videoConferenceService.joinSession({
      sessionId: client.data.sessionId,
      participantType: body.participantType,
      participantId: body.participantId,
      token: body.token,
    });

    client.data.participantType = body.participantType;
    client.data.participantId = body.participantId;
    client.data.joined = true;
    await client.join(client.data.roomId);

    return {
      event: 'joined',
      data: {
        sessionId: result.session.id,
        roomId: result.session.roomId,
        accessToken: result.accessToken,
        streamUrl: result.streamUrl,
        iceServers: result.iceServers,
      },
    };
  }

  @SubscribeMessage('sdp-offer')
  relayOffer(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: unknown) {
    return this.relay(client, 'sdp-offer', body);
  }

  @SubscribeMessage('sdp-answer')
  relayAnswer(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: unknown) {
    return this.relay(client, 'sdp-answer', body);
  }

  @SubscribeMessage('ice-candidate')
  relayIceCandidate(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: unknown) {
    return this.relay(client, 'ice-candidate', body);
  }

  @SubscribeMessage('connection-state')
  async connectionState(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { state: string; details?: Record<string, unknown> },
  ) {
    if (!client.data.joined || !client.data.sessionId || !client.data.participantType) {
      throw new WsException('Join the session before reporting connection state');
    }
    if (!body?.state || body.state.length > 64) {
      throw new WsException('Connection state is required');
    }

    await this.videoConferenceService.recordConnectionState(
      client.data.sessionId,
      client.data.participantType,
      body.state,
      body.details,
    );
    return { event: 'connection-state-recorded', data: { state: body.state } };
  }

  private relay(client: AuthenticatedSocket, event: string, body: unknown) {
    if (!client.data.joined || !client.data.roomId || !client.data.participantType) {
      throw new WsException('Join the session before sending signaling messages');
    }
    if (!body || typeof body !== 'object') {
      throw new WsException('Signaling payload is required');
    }

    client.to(client.data.roomId).emit(event, {
      ...(body as Record<string, unknown>),
      participantType: client.data.participantType,
    });
    return { event: `${event}-relayed` };
  }
}
