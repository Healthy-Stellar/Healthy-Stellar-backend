import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export interface SubscriptionContext {
  user: {
    sub: string;
    patientId: string;
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
    private readonly jwtService: JwtService,
    @InjectRedis() private readonly redis: Redis,
    private readonly config: ConfigService,
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
      payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new Error('Invalid or expired token');
    }

    const userId: string = payload.sub;
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
        sub: payload.sub,
        patientId: payload.patientId,
        role: payload.role,
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
