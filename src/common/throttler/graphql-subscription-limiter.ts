import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface ConnectionContext {
  userId?: string;
  tenantId?: string;
}

@Injectable()
export class GraphQLSubscriptionLimiter {
  private redis: Redis;
  private readonly defaultMaxPerUser: number;
  private readonly defaultMaxPerTenant: number;

  constructor(private configService: ConfigService) {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');
    const redisDb = this.configService.get<number>('REDIS_DB', 0);

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword || undefined,
      db: redisDb,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.defaultMaxPerUser = this.configService.get<number>(
      'GRAPHQL_MAX_SUBSCRIPTIONS_PER_USER',
      10,
    );
    this.defaultMaxPerTenant = this.configService.get<number>(
      'GRAPHQL_MAX_SUBSCRIPTIONS_PER_TENANT',
      100,
    );
  }

  async checkLimit(context: ConnectionContext): Promise<{ allowed: boolean; reason?: string }> {
    const { userId, tenantId } = context;

    // Anonymous connections not allowed
    if (!userId) {
      return { allowed: false, reason: 'Authentication required for subscriptions' };
    }

    // Check per-user limit
    if (userId) {
      const userKey = `gql:subscriptions:user:${userId}`;
      const userCount = await this.redis.incr(userKey);

      if (userCount === 1) {
        // First subscription for this user, set expiry
        await this.redis.expire(userKey, 3600);
      }

      if (userCount > this.defaultMaxPerUser) {
        await this.redis.decr(userKey);
        return {
          allowed: false,
          reason: `Per-user subscription limit exceeded (${this.defaultMaxPerUser} max)`,
        };
      }
    }

    // Check per-tenant limit
    if (tenantId) {
      const tenantKey = `gql:subscriptions:tenant:${tenantId}`;
      const tenantCount = await this.redis.incr(tenantKey);

      if (tenantCount === 1) {
        await this.redis.expire(tenantKey, 3600);
      }

      if (tenantCount > this.defaultMaxPerTenant) {
        // Rollback user count
        if (userId) {
          await this.redis.decr(`gql:subscriptions:user:${userId}`);
        }
        await this.redis.decr(tenantKey);
        return {
          allowed: false,
          reason: `Per-tenant subscription limit exceeded (${this.defaultMaxPerTenant} max)`,
        };
      }
    }

    return { allowed: true };
  }

  async releaseConnection(context: ConnectionContext): Promise<void> {
    const { userId, tenantId } = context;

    if (userId) {
      const userKey = `gql:subscriptions:user:${userId}`;
      await this.redis.decr(userKey);
    }

    if (tenantId) {
      const tenantKey = `gql:subscriptions:tenant:${tenantId}`;
      await this.redis.decr(tenantKey);
    }
  }
}
