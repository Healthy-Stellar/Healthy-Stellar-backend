import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GraphQLSubscriptionLimiter } from './graphql-subscription-limiter';

describe('GraphQLSubscriptionLimiter', () => {
  let limiter: GraphQLSubscriptionLimiter;
  let configService: Partial<ConfigService>;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
          REDIS_PASSWORD: undefined,
          REDIS_DB: 0,
          GRAPHQL_MAX_SUBSCRIPTIONS_PER_USER: 10,
          GRAPHQL_MAX_SUBSCRIPTIONS_PER_TENANT: 100,
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphQLSubscriptionLimiter,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    limiter = module.get<GraphQLSubscriptionLimiter>(GraphQLSubscriptionLimiter);
  });

  afterEach(async () => {
    // Clean up Redis connections
    if ((limiter as any).redis) {
      await (limiter as any).redis.flushdb();
      await (limiter as any).redis.quit();
    }
  });

  it('should allow connection within per-user limit', async () => {
    const result = await limiter.checkLimit({ userId: 'user-1', tenantId: 'tenant-1' });
    expect(result.allowed).toBe(true);
  });

  it('should reject anonymous connections', async () => {
    const result = await limiter.checkLimit({ userId: undefined, tenantId: 'tenant-1' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Authentication required');
  });

  it('should reject connections exceeding per-user limit', async () => {
    const userId = 'user-1';
    const tenantId = 'tenant-1';

    // Allow up to the limit
    for (let i = 0; i < 10; i++) {
      const result = await limiter.checkLimit({ userId, tenantId });
      expect(result.allowed).toBe(true);
    }

    // Next connection should be rejected
    const rejectedResult = await limiter.checkLimit({ userId, tenantId });
    expect(rejectedResult.allowed).toBe(false);
    expect(rejectedResult.reason).toContain('Per-user subscription limit exceeded');
  });

  it('should reject connections exceeding per-tenant limit', async () => {
    const tenantId = 'tenant-1';

    // Create many users to hit tenant limit
    for (let i = 0; i < 100; i++) {
      const result = await limiter.checkLimit({
        userId: `user-${i}`,
        tenantId,
      });
      expect(result.allowed).toBe(true);
    }

    // Next user should be rejected due to tenant limit
    const rejectedResult = await limiter.checkLimit({
      userId: 'user-100',
      tenantId,
    });
    expect(rejectedResult.allowed).toBe(false);
    expect(rejectedResult.reason).toContain('Per-tenant subscription limit exceeded');
  });

  it('should reset count when connection is released', async () => {
    const userId = 'user-1';
    const tenantId = 'tenant-1';

    // Add a connection
    const result1 = await limiter.checkLimit({ userId, tenantId });
    expect(result1.allowed).toBe(true);

    // Release it
    await limiter.releaseConnection({ userId, tenantId });

    // Should be able to add another
    const result2 = await limiter.checkLimit({ userId, tenantId });
    expect(result2.allowed).toBe(true);
  });

  it('should handle multiple concurrent users within tenant limit', async () => {
    const tenantId = 'tenant-1';
    const promises = [];

    for (let i = 0; i < 50; i++) {
      promises.push(
        limiter.checkLimit({
          userId: `user-${i}`,
          tenantId,
        }),
      );
    }

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.allowed).length;
    expect(successCount).toBe(50);
  });
});
