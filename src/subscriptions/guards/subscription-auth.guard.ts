import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { AuthTokenService } from '../../auth/services/auth-token.service';
import { SessionManagementService } from '../../auth/services/session-management.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface SubscriptionContext {
  user: {
    userId: string;
    patientId?: string;
    role: string;
  };
  connectionId: string;
}

const MAX_CONNECTIONS_PER_USER = 5;
const CONNECTION_KEY_PREFIX = 'ws_conn:';
const CONNECTION_TTL_SECONDS = 86400; // 24h safety TTL

@Injectable()
export class SubscriptionAuthGuard {
  private readonly logger = new Logger(SubscriptionAuthGuard.name);

  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly sessionManagementService: SessionManagementService,
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async validateConnection(connectionParams: Record<string, any>): Promise<SubscriptionContext> {
    const token =
      connectionParams?.Authorization?.replace('Bearer ', '') ||
      connectionParams?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new Error('Missing authorization token');
    }

    let payload: any;
    try {
      payload = await this.authTokenService.verifyAccessToken(token);
    } catch {
      throw new Error('Invalid or expired token');
    }

    const userId: string = payload?.userId;
    if (!userId) {
      throw new Error('Invalid or expired token');
    }

    if (payload.sessionId) {
      const sessionValid = await this.sessionManagementService.isSessionValid(payload.sessionId);
      if (!sessionValid) {
        throw new Error('Session has been revoked');
      }
    }

    const role: string = payload.role;
    let patientId: string | undefined;
    if (role === 'PATIENT') {
      const patient = await this.prisma.patient.findFirst({
        where: { userId },
        select: { id: true },
      });
      patientId = patient?.id;
    }

    const connectionId = `${userId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const connKey = `${CONNECTION_KEY_PREFIX}${userId}`;

    const currentCount = await this.redis.scard(connKey);
    if (currentCount >= MAX_CONNECTIONS_PER_USER) {
      throw new Error(
        `Connection limit reached. Maximum ${MAX_CONNECTIONS_PER_USER} concurrent connections allowed.`,
      );
    }

    await this.redis.sadd(connKey, connectionId);
    await this.redis.expire(connKey, CONNECTION_TTL_SECONDS);

    this.logger.log(`WebSocket connected: user=${userId} connectionId=${connectionId}`);

    return {
      user: {
        userId,
        patientId,
        role,
      },
      connectionId,
    };
  }

  async onDisconnect(userId: string, connectionId: string): Promise<void> {
    const connKey = `${CONNECTION_KEY_PREFIX}${userId}`;
    await this.redis.srem(connKey, connectionId);
    this.logger.log(`WebSocket disconnected: user=${userId} connectionId=${connectionId}`);
  }
}
