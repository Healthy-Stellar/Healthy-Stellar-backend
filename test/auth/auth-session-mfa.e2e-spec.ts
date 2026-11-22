import { Controller, Get, INestApplication, UseGuards, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import * as request from 'supertest';

import { AuthController } from '../../src/auth/controllers/auth.controller';
import { MfaController } from '../../src/auth/controllers/mfa.controller';
import { User, UserRole } from '../../src/auth/entities/user.entity';
import { SessionEntity } from '../../src/auth/entities/session.entity';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { MfaVerifiedGuard } from '../../src/auth/guards/mfa-verified.guard';
import { ClinicalMfaGuard } from '../../src/auth/guards/clinical-mfa.guard';
import { AuthService } from '../../src/auth/services/auth.service';
import { AuthTokenService } from '../../src/auth/services/auth-token.service';
import { MfaService } from '../../src/auth/services/mfa.service';
import { PasswordValidationService } from '../../src/auth/services/password-validation.service';
import { RefreshTokenStoreService } from '../../src/auth/services/refresh-token-store.service';
import { SecretRotationService } from '../../src/auth/services/secret-rotation.service';
import { SessionManagementService } from '../../src/auth/services/session-management.service';
import { SessionRevocationService } from '../../src/auth/services/session-revocation.service';
import { AuditLogService } from '../../src/common/services/audit-log.service';
import { AuditService } from '../../src/common/audit/audit.service';

/**
 * Regression coverage for:
 *  - #1323: the JWT `sessionId` must be the primary key of the persisted
 *    session, otherwise JwtAuthGuard / logout / refresh never find the row.
 *  - #1322: a password-only login followed by /auth/refresh must not yield a
 *    token that MFA-gated routes accept.
 *
 * The real auth services, guards and controllers are wired up; only storage
 * (Postgres, Redis) and password hashing are replaced with in-memory fakes.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_TOTP = '123456';
const PASSWORD = 'Correct-Horse-Battery-9';

/** A route gated on the session-scoped MFA claim (MfaVerifiedGuard). */
@Controller('test-mfa-gated')
class MfaGatedController {
  @Get()
  @UseGuards(JwtAuthGuard, MfaVerifiedGuard)
  get() {
    return { ok: true };
  }
}

/** A clinical route gated by ClinicalMfaGuard (path prefix /patients). */
@Controller('patients/test-clinical-mfa')
class ClinicalGatedController {
  @Get()
  @UseGuards(JwtAuthGuard, ClinicalMfaGuard)
  get() {
    return { ok: true };
  }
}

function pgInvalidUuid(value: unknown): Error {
  return new Error(`invalid input syntax for type uuid: "${String(value)}"`);
}

function matchesWhere(row: Record<string, any>, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === 'object' && '_type' in expected) {
      const op = expected as { _type: string; _value: any };
      if (op._type === 'moreThan') return row[key] > op._value;
      if (op._type === 'lessThan') return row[key] < op._value;
      throw new Error(`Unsupported operator ${op._type} in fake repository`);
    }
    return row[key] === expected;
  });
}

/** In-memory `sessions` repository with a uuid primary key, like Postgres. */
function createSessionRepository() {
  const rows = new Map<string, SessionEntity>();

  const assertUuid = (id: unknown) => {
    if (id !== undefined && !UUID_RE.test(String(id))) throw pgInvalidUuid(id);
  };

  const saveOne = (entity: SessionEntity) => {
    if (entity.id === undefined) entity.id = randomUUID();
    assertUuid(entity.id);
    const now = new Date();
    const existing = rows.get(entity.id);
    const row = { ...existing, ...entity, createdAt: existing?.createdAt ?? now, updatedAt: now };
    rows.set(row.id, row as SessionEntity);
    Object.assign(entity, row);
    return entity;
  };

  return {
    rows,
    create: jest.fn((data: Partial<SessionEntity>) => ({ ...data }) as SessionEntity),
    save: jest.fn(async (entity: SessionEntity | SessionEntity[]) =>
      Array.isArray(entity) ? entity.map(saveOne) : saveOne(entity),
    ),
    findOne: jest.fn(async ({ where }: { where: Record<string, any> }) => {
      assertUuid(where.id);
      const found = [...rows.values()].find((row) => matchesWhere(row, where));
      return found ? ({ ...found } as SessionEntity) : null;
    }),
    find: jest.fn(async ({ where }: { where: Record<string, any> }) => {
      assertUuid(where.id);
      return [...rows.values()]
        .filter((row) => matchesWhere(row, where))
        .map((row) => ({ ...row }) as SessionEntity);
    }),
    update: jest.fn(async (criteria: Record<string, any>, partial: Partial<SessionEntity>) => {
      assertUuid(criteria.id);
      for (const row of rows.values()) {
        if (matchesWhere(row, criteria)) Object.assign(row, partial);
      }
      return { affected: 1 };
    }),
  };
}

function createUserRepository() {
  const rows = new Map<string, User>();
  return {
    rows,
    create: jest.fn((data: Partial<User>) => ({ ...data }) as User),
    save: jest.fn(async (user: User) => {
      if (!user.id) user.id = randomUUID();
      rows.set(user.id, { ...rows.get(user.id), ...user } as User);
      return { ...rows.get(user.id) } as User;
    }),
    findOne: jest.fn(async ({ where }: { where: Record<string, any> }) => {
      const found = [...rows.values()].find((row) => matchesWhere(row, where));
      return found ? ({ ...found } as User) : null;
    }),
    update: jest.fn(async (id: string, partial: Partial<User>) => {
      const row = rows.get(id);
      if (row) Object.assign(row, partial);
      return { affected: row ? 1 : 0 };
    }),
  };
}

/** In-memory stand-in for the Redis-backed refresh token store. */
function createRefreshTokenStore() {
  const active = new Map<string, string>();
  const consumed = new Set<string>();
  const hash = (token: string) => createHash('sha256').update(token).digest('hex');
  return {
    active,
    store: jest.fn(async (sessionId: string, token: string) => {
      active.set(sessionId, hash(token));
    }),
    consumeAndValidate: jest.fn(async (sessionId: string, token: string) => {
      const { UnauthorizedException } = await import('@nestjs/common');
      const tokenHash = hash(token);
      if (consumed.has(tokenHash)) {
        active.delete(sessionId);
        throw new UnauthorizedException('Refresh token reuse detected — session revoked');
      }
      if (active.get(sessionId) !== tokenHash) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      active.delete(sessionId);
      consumed.add(tokenHash);
    }),
    revokeSession: jest.fn(async (sessionId: string) => {
      active.delete(sessionId);
    }),
  };
}

describe('Auth sessions & MFA (e2e) — #1322 / #1323', () => {
  let app: INestApplication;
  let userRepo: ReturnType<typeof createUserRepository>;
  let sessionRepo: ReturnType<typeof createSessionRepository>;
  let refreshStore: ReturnType<typeof createRefreshTokenStore>;
  let jwtService: JwtService;

  /** Account-level MFA enrolment, as MfaService would report it. */
  const mfaEnrolled = new Set<string>();

  const mfaServiceMock = {
    isMfaEnabled: jest.fn(async (userId: string) => mfaEnrolled.has(userId)),
    verifyMfaCode: jest.fn(async (_userId: string, code: string) => code === VALID_TOTP),
    verifyBackupCodeOnly: jest.fn(async () => ({ success: false, remainingCodes: 0 })),
  };

  const passwordValidationMock = {
    validatePassword: jest.fn(() => ({ isValid: true, errors: [] })),
    hashPassword: jest.fn(async (pw: string) => `fake-hash:${pw}`),
    verifyPassword: jest.fn(async (pw: string, hashValue: string) => hashValue === `fake-hash:${pw}`),
    isPasswordExpired: jest.fn(() => false),
    getPolicy: jest.fn(() => ({ lockoutThreshold: 5, lockoutDurationMinutes: 30 })),
  };

  const server = () => app.getHttpServer();
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function seedUser(role: UserRole, { mfa }: { mfa: boolean }): Promise<User> {
    const user = await userRepo.save({
      email: `${role}-${randomUUID()}@example.test`,
      passwordHash: `fake-hash:${PASSWORD}`,
      firstName: 'Test',
      lastName: role,
      role,
      isActive: true,
      mfaEnabled: mfa,
      failedLoginAttempts: 0,
      requiresPasswordChange: false,
      lastPasswordChangeAt: new Date(),
    } as User);
    if (mfa) mfaEnrolled.add(user.id);
    return user;
  }

  const login = (email: string) =>
    request(server()).post('/auth/login').send({ email, password: PASSWORD });

  beforeAll(async () => {
    userRepo = createUserRepository();
    sessionRepo = createSessionRepository();
    refreshStore = createRefreshTokenStore();

    const config = new ConfigService({
      JWT_SECRET: 'e2e-access-secret-0123456789abcdef',
      JWT_REFRESH_SECRET: 'e2e-refresh-secret-0123456789abcdef',
      MAX_SESSIONS_PER_USER: 5,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'e2e-access-secret-0123456789abcdef',
          signOptions: { expiresIn: '15m', algorithm: 'HS512' },
        }),
      ],
      controllers: [AuthController, MfaController, MfaGatedController, ClinicalGatedController],
      providers: [
        AuthService,
        AuthTokenService,
        SecretRotationService,
        SessionManagementService,
        JwtAuthGuard,
        MfaVerifiedGuard,
        ClinicalMfaGuard,
        { provide: ConfigService, useValue: config },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(SessionEntity), useValue: sessionRepo },
        { provide: RefreshTokenStoreService, useValue: refreshStore },
        { provide: MfaService, useValue: mfaServiceMock },
        { provide: PasswordValidationService, useValue: passwordValidationMock },
        { provide: AuditLogService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: AuditService,
          useValue: { logAuthenticationEvent: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: SessionRevocationService,
          useValue: {
            notifySessionRevoked: jest.fn().mockResolvedValue(undefined),
            notifyUserSessionsRevoked: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('#1323 — JWT sessionId is the persisted session primary key', () => {
    it('register → login → GET /auth/me returns 200; logout → GET /auth/me returns 401', async () => {
      const email = `patient-${randomUUID()}@example.test`;

      await request(server())
        .post('/auth/register')
        .send({ email, password: PASSWORD, firstName: 'Pat', lastName: 'Ient' })
        .expect(201);

      const loginRes = await login(email).expect(201);
      const { accessToken } = loginRes.body.tokens;

      const { sessionId } = jwtService.decode(accessToken) as { sessionId: string };
      expect(sessionId).toMatch(UUID_RE);
      expect(sessionRepo.rows.has(sessionId)).toBe(true);

      const me = await request(server()).get('/auth/me').set(bearer(accessToken)).expect(200);
      expect(me.body.email).toBe(email);

      await request(server()).post('/auth/logout').set(bearer(accessToken)).expect(201);
      expect(sessionRepo.rows.get(sessionId)?.isActive).toBe(false);

      await request(server()).get('/auth/me').set(bearer(accessToken)).expect(401);
    });

    it('refresh rotates tokens for the same persisted session', async () => {
      const user = await seedUser(UserRole.PATIENT, { mfa: false });
      const { tokens } = (await login(user.email).expect(201)).body;

      const refreshed = await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(201);

      const before = jwtService.decode(tokens.accessToken) as { sessionId: string };
      const after = jwtService.decode(refreshed.body.accessToken) as { sessionId: string };
      expect(after.sessionId).toBe(before.sessionId);

      await request(server()).get('/auth/me').set(bearer(refreshed.body.accessToken)).expect(200);

      // The rotated-out refresh token is single-use.
      await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });

    it('rejects a token whose sessionId is not a UUID with 401 (no DB error leaks)', async () => {
      const user = await seedUser(UserRole.PATIENT, { mfa: false });
      const forged = app.get(AuthTokenService).generateAccessToken(user, 'a'.repeat(32), false);

      await request(server()).get('/auth/me').set(bearer(forged)).expect(401);
    });
  });

  describe('#1322 — MFA cannot be bypassed via /auth/refresh', () => {
    it('password-only login returns no token pair, only a short-lived MFA-pending token', async () => {
      const user = await seedUser(UserRole.PHYSICIAN, { mfa: true });

      const res = await login(user.email).expect(201);

      expect(res.body.mfaRequired).toBe(true);
      expect(res.body.tokens).toBeUndefined();
      expect(typeof res.body.mfaToken).toBe('string');
      expect(res.body.mfaTokenExpiresIn).toBeLessThanOrEqual(300);

      const claims = jwtService.decode(res.body.mfaToken) as Record<string, any>;
      expect(claims.mfaPending).toBe(true);
      expect(claims.mfaVerified).toBe(false);
      expect(claims).not.toHaveProperty('mfaEnabled');
      expect(sessionRepo.rows.get(claims.sessionId)?.mfaVerified).toBe(false);
    });

    it('password-only login → refresh → MFA-gated route returns 401', async () => {
      const user = await seedUser(UserRole.PHYSICIAN, { mfa: true });
      const { mfaToken } = (await login(user.email).expect(201)).body;

      // The only credential a password-only attacker holds cannot be refreshed…
      const refresh = await request(server()).post('/auth/refresh').send({ refreshToken: mfaToken });
      expect(refresh.status).toBeGreaterThanOrEqual(400);
      expect(refresh.body.accessToken).toBeUndefined();

      // …and is refused by every MFA-gated (and ordinary) route.
      await request(server()).get('/test-mfa-gated').set(bearer(mfaToken)).expect(401);
      await request(server()).get('/patients/test-clinical-mfa').set(bearer(mfaToken)).expect(401);
      await request(server()).get('/auth/me').set(bearer(mfaToken)).expect(401);
    });

    it('refresh keeps an unverified session unverified even when the account has MFA enabled', async () => {
      // Session established before MFA enrolment, i.e. holding a real refresh
      // token for a session that never completed an MFA challenge.
      const user = await seedUser(UserRole.PATIENT, { mfa: false });
      const { tokens } = (await login(user.email).expect(201)).body;

      // The account later enables MFA (the flag the old refresh code trusted).
      await userRepo.update(user.id, { mfaEnabled: true });
      mfaEnrolled.add(user.id);

      const refreshed = await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(201);

      const claims = jwtService.decode(refreshed.body.accessToken) as Record<string, any>;
      expect(claims.mfaVerified).toBe(false);

      await request(server())
        .get('/test-mfa-gated')
        .set(bearer(refreshed.body.accessToken))
        .expect(401);
    });

    it('a wrong TOTP code issues nothing', async () => {
      const user = await seedUser(UserRole.PHYSICIAN, { mfa: true });
      const { mfaToken } = (await login(user.email).expect(201)).body;

      const res = await request(server())
        .post('/auth/mfa/verify-code')
        .set(bearer(mfaToken))
        .send({ code: '000000' })
        .expect(400);

      expect(res.body.accessToken).toBeUndefined();
      const { sessionId } = jwtService.decode(mfaToken) as { sessionId: string };
      expect(sessionRepo.rows.get(sessionId)?.mfaVerified).toBe(false);
    });

    it('verify-code issues the verified pair, and refresh preserves the verified state', async () => {
      const user = await seedUser(UserRole.PHYSICIAN, { mfa: true });
      const { mfaToken } = (await login(user.email).expect(201)).body;
      const { sessionId } = jwtService.decode(mfaToken) as { sessionId: string };

      const verified = await request(server())
        .post('/auth/mfa/verify-code')
        .set(bearer(mfaToken))
        .send({ code: VALID_TOTP })
        .expect(201);

      expect(verified.body.success).toBe(true);
      const claims = jwtService.decode(verified.body.accessToken) as Record<string, any>;
      expect(claims.mfaVerified).toBe(true);
      expect(claims.mfaPending).toBeUndefined();
      expect(claims.sessionId).toBe(sessionId);
      expect(sessionRepo.rows.get(sessionId)?.mfaVerified).toBe(true);

      await request(server())
        .get('/test-mfa-gated')
        .set(bearer(verified.body.accessToken))
        .expect(200);
      await request(server())
        .get('/patients/test-clinical-mfa')
        .set(bearer(verified.body.accessToken))
        .expect(200);

      const refreshed = await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: verified.body.refreshToken })
        .expect(201);

      expect((jwtService.decode(refreshed.body.accessToken) as any).mfaVerified).toBe(true);
      await request(server())
        .get('/test-mfa-gated')
        .set(bearer(refreshed.body.accessToken))
        .expect(200);
    });
  });
});
