/**
 * HTTP harness for authz/IDOR tests that need the *real* authentication flow:
 *
 *   RequestContextMiddleware  →  JwtAuthGuard  →  controller  →  service
 *
 * Only token verification and session lookup are faked (no JWT secret, DB or
 * Redis required). Tokens are produced with `bearer(user)`; anything else is
 * rejected by JwtAuthGuard with 401, exactly as in production.
 *
 * Also provides `InMemoryRepository`, a tiny TypeORM-like repository whose
 * `where` matching mirrors TypeORM's behaviour of silently dropping
 * `undefined` keys, so tests catch "query with undefined userId" bugs.
 */
import {
  CanActivate,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  Provider,
  Type,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { RequestContextMiddleware } from '../../src/common/middleware/request-context.middleware';
import { AuthTokenService } from '../../src/auth/services/auth-token.service';
import { SessionManagementService } from '../../src/auth/services/session-management.service';
import { TenantContext } from '../../src/tenant/context/tenant.context';

export const HARNESS_TENANT_ID = 'tenant-harness';

export interface HarnessUser {
  userId: string;
  role: string;
  organizationId?: string;
}

/** Builds an Authorization header value accepted by the fake AuthTokenService. */
export function bearer(user: HarnessUser): string {
  const payload = {
    email: `${user.userId}@example.test`,
    mfaEnabled: false,
    sessionId: `session-${user.userId}`,
    organizationId: user.organizationId ?? HARNESS_TENANT_ID,
    ...user,
  };
  return `Bearer harness.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
}

const fakeAuthTokenService = {
  verifyAccessToken(token: string) {
    if (!token?.startsWith('harness.')) return null;
    try {
      return JSON.parse(Buffer.from(token.slice('harness.'.length), 'base64url').toString('utf8'));
    } catch {
      return null;
    }
  },
};

const fakeSessionManagementService = {
  isSessionValid: async () => true,
  updateSessionActivity: async () => undefined,
};

export interface HarnessOptions {
  controllers: Type<any>[];
  providers: Provider[];
  /** Guards unrelated to the behaviour under test, replaced with allow-all. */
  allowGuards?: Type<CanActivate>[];
}

export async function createJwtHttpHarness(opts: HarnessOptions): Promise<INestApplication> {
  @Module({
    controllers: opts.controllers,
    providers: [
      ...opts.providers,
      { provide: AuthTokenService, useValue: fakeAuthTokenService },
      { provide: SessionManagementService, useValue: fakeSessionManagementService },
    ],
  })
  class HarnessModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
      consumer
        .apply(RequestContextMiddleware, (_req: any, _res: any, next: () => void) =>
          TenantContext.run(
            {
              tenantId: HARNESS_TENANT_ID,
              tenantSlug: HARNESS_TENANT_ID,
              schemaName: `tenant_${HARNESS_TENANT_ID}`,
            },
            next,
          ),
        )
        .forRoutes('*');
    }
  }

  let builder = Test.createTestingModule({ imports: [HarnessModule] });
  for (const guard of opts.allowGuards ?? []) {
    builder = builder.overrideGuard(guard).useValue({ canActivate: () => true });
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return app;
}

// ── In-memory repository ────────────────────────────────────────────────────

function matches(row: any, where: any): boolean {
  if (!where) return true;
  if (Array.isArray(where)) return where.some((w) => matches(row, w));
  return Object.entries(where).every(([key, expected]) => {
    // TypeORM drops undefined keys from WHERE — mirror that on purpose.
    if (expected === undefined) return true;
    const actual = row?.[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      const op = expected as any;
      if (op._type === 'in') return (op._value as any[]).includes(actual);
      if (op._type === 'between') return actual >= op._value[0] && actual <= op._value[1];
      return matches(actual, expected);
    }
    return actual === expected;
  });
}

export class InMemoryRepository<T extends { id?: string }> {
  rows: T[] = [];

  constructor(seed: T[] = []) {
    this.rows = seed.map((r) => ({ ...r }));
  }

  create(data: Partial<T>): T {
    return { ...(data as T) };
  }

  async save(entity: T): Promise<T> {
    if (!entity.id) (entity as any).id = randomUUID();
    if (!(entity as any).createdAt) (entity as any).createdAt = new Date();
    const i = this.rows.findIndex((r) => r.id === entity.id);
    if (i >= 0) this.rows[i] = { ...this.rows[i], ...entity };
    else this.rows.push(entity);
    return entity;
  }

  async find(opts: { where?: any } = {}): Promise<T[]> {
    return this.rows.filter((r) => matches(r, opts.where));
  }

  async findOne(opts: { where?: any } = {}): Promise<T | null> {
    return this.rows.find((r) => matches(r, opts.where)) ?? null;
  }

  async findAndCount(opts: { where?: any; take?: number; skip?: number } = {}): Promise<[T[], number]> {
    const all = this.rows.filter((r) => matches(r, opts.where));
    const skip = Number.isFinite(opts.skip) ? (opts.skip as number) : 0;
    const take = Number.isFinite(opts.take) ? (opts.take as number) : all.length;
    return [all.slice(skip, skip + take), all.length];
  }
}
