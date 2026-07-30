import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WsException,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from '../notifications/guards/ws-auth.guard';
import { WsJwtMiddleware } from '../notifications/middleware/ws-jwt.middleware';
import { VitalsService, VitalsSubmissionResult, VitalsThresholdBreach } from './services/vitals.service';
import { SubmitVitalsDto } from './dto/submit-vitals.dto';
import { PatientVital } from './entities/patient-vital.entity';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN || '*', credentials: true },
  namespace: '/vitals',
})
@UseGuards(WsAuthGuard)
export class VitalsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VitalsGateway.name);

  constructor(
    private readonly vitalsService: VitalsService,
    private readonly wsJwtMiddleware: WsJwtMiddleware,
  ) {}

  afterInit(server: Server) {
    server.use(this.wsJwtMiddleware.build());
  }

  handleConnection(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.userId;
    if (!userId) {
      client.disconnect();
      return;
    }
    this.logger.log(`Vitals WS connected: ${client.id} (user ${userId})`);
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    this.logger.log(`Vitals WS disconnected: ${client.id}`);
  }

  /** Subscribe to real-time vitals for a patient room. */
  @SubscribeMessage('vitals:subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { patientId: string },
  ): void {
    if (!data?.patientId) throw new WsException('patientId is required');
    const room = this.patientRoom(data.patientId);
    client.join(room);
    this.logger.debug(`Client ${client.id} subscribed to ${room}`);
  }

  /** Unsubscribe from a patient room. */
  @SubscribeMessage('vitals:unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { patientId: string },
  ): void {
    if (!data?.patientId) return;
    client.leave(this.patientRoom(data.patientId));
  }

  /** Submit new vitals (authenticated clinical staff). */
  @SubscribeMessage('vitals:submit')
  async handleSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SubmitVitalsDto,
  ): Promise<{ success: boolean; breaches: VitalsThresholdBreach[] }> {
    const user = client.data.user;
    if (!user) throw new WsException('Unauthorized');

    const tenantId: string | undefined = user.tenantId;
    const result: VitalsSubmissionResult = await this.vitalsService.submit(
      dto,
      user.userId,
      tenantId,
    );

    this.broadcast(result.vital, result.breaches);

    return { success: true, breaches: result.breaches };
  }

  /** Broadcast vitals update and any threshold alerts to subscribers. */
  broadcast(vital: PatientVital, breaches: VitalsThresholdBreach[]): void {
    const room = this.patientRoom(vital.patientId);

    this.server.to(room).emit('vitals:update', {
      patientId: vital.patientId,
      vitalId: vital.id,
      recordedAt: vital.recordedAt,
      heartRate: vital.heartRate,
      systolicBp: vital.systolicBp,
      diastolicBp: vital.diastolicBp,
      oxygenSaturation: vital.oxygenSaturation,
      temperature: vital.temperature,
      respiratoryRate: vital.respiratoryRate,
      bloodGlucose: vital.bloodGlucose,
    });

    if (breaches.length > 0) {
      this.server.to(room).emit('vitals:alert', {
        patientId: vital.patientId,
        vitalId: vital.id,
        recordedAt: vital.recordedAt,
        breaches,
        hasCritical: breaches.some((b) => b.severity === 'critical'),
      });

      this.logger.warn(
        `Threshold alert emitted for patient ${vital.patientId}: ${breaches.map((b) => b.metric).join(', ')}`,
      );
    }
  }

  private patientRoom(patientId: string): string {
    return `patient:${patientId}`;
  }
}
