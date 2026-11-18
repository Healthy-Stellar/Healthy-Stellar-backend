/**
 * e2e: password change and reset revoke other devices' sessions
 *
 * Scenario:
 *   1. A user logs in from two "devices" (device A, device B).
 *   2. Device A changes (or resets) the password.
 *   3. Device B's access token and refresh token must be rejected.
 *   4. Device A's tokens remain valid (change-password only).
 */

import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';

import { AuthController } from '../../src/auth/controllers/auth.controller';
import { AuthService } from '../../src/auth/services/auth.service';
import { AuthTokenService } from '../../src/auth/services/auth-token.service';
import { MfaService } from '../../src/auth/services/mfa.service';
import { SessionManagementService } from '../../src/auth/services/session-management.service';
import { RefreshTokenStoreService } from '../../src/auth/services/refresh-token-store.service';
import { PasswordValidationService } from '../../src/auth/services/password-validation.service';
import { AuditLogService } from '../../src/common/services/audit-log.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { User, UserRole } from '../../src/auth/entities/user.entity';
import { SessionEntity } from '../../src/auth/entities/session.entity';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = 'user-abc';
const SESSION_A = 'session-device-a';
const SESSION_B = 'session-device-b';

const baseUser: Partial<User> = {
  id: USER_ID,
  email: 'user@example.test',
  passwordHash: 'hashed',
  firstName: 'Alice',
  lastName: 'Smith',
  role: UserRole.PATIENT,
  isActive: true,
  mfaEnabled: false,
  failedLoginAttempts: 0,
  requiresPasswordChange: false,
};

/**
 * Guard that injects a pre-built JwtPayload from the test request header
 * `x-session-id` and `x-user-id` so we can simulate two separate devices
 * without actually signing JWTs.
 */
class InjectSessionGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const sessionId = req.headers['x-session-id'] ?? SESSION_A;
    const userId = req.headers['x-user-id'] ?? USER_ID;
    req.user = {
      userId,
      email: baseUser.email,
      role: UserRole.PATIENT,
      mfaEnabled: false,
      sessionId,
      organizationId: null,
    };
    return true;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Password change/reset — session revocation (e2e)', () => {
  let app: INestApplication;

  // Track which sessions have been revoked so assertions can inspect state.
  const revokedSessions = new Set<string>();
  const revokedRedisKeys = new Set<string>();

  const userRepo = {
    findOne: jest.fn().mockResolvedValue({ ...baseUser }),
    save: jest.fn().mockResolvedValue({ ...baseUser }),
    update: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  };

  const passwordValidation = {
    validatePassword: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    hashPassword: jest.fn().mockResolvedValue('new-hashed'),
    verifyPassword: jest.fn().mockResolvedValue(true),
    isPasswordExpired: jest.fn().mockReturnValue(false),
    getPolicy: jest.fn().mockReturnValue({ lockoutThreshold: 5, lockoutDurationMinutes: 15 }),
  };

  // Two active sessions — simulates two logged-in devices.
  const activeSessions: SessionEntity[] = [
    { id: SESSION_A } as SessionEntity,
    { id: SESSION_B } as SessionEntity,
  ];

  const sessionManagement = {
    createSession: jest.fn().mockResolvedValue({ id: SESSION_A }),
    getUserSessions: jest.fn().mockResolvedValue([...activeSessions]),

    revokeAllUserSessions: jest.fn().mockImplementation(async () => {
      activeSessions.forEach((s) => revokedSessions.add(s.id));
      return activeSessions.length;
    }),

    revokeAllUserSessionsExcept: jest.fn().mockImplementation(
      async (_userId: string, excludeId: string) => {
        const toRevoke = activeSessions
          .filter((s) => s.id !== excludeId)
          .map((s) => s.id);
        toRevoke.forEach((id) => revokedSessions.add(id));
        return toRevoke;
      },
    ),
  };

  const refreshTokenStore = {
    store: jest.fn().mockResolvedValue(undefined),
    revokeSession: jest.fn().mockResolvedValue(undefined),
    revokeSessionIds: jest.fn().mockImplementation(async (ids: string[]) => {
      ids.forEach((id) => revokedRedisKeys.add(id));
    }),
  };

  const auditLog = { log: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: PasswordValidationService, useValue: passwordValidation },
        { provide: AuthTokenService, useValue: {} },
        { provide: MfaService, useValue: {} },
        { provide: SessionManagementService, useValue: sessionManagement },
        { provide: RefreshTokenStoreService, useValue: refreshTokenStore },
        { provide: AuditLogService, useValue: auditLog },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(InjectSessionGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    revokedSessions.clear();
    revokedRedisKeys.clear();
    jest.clearAllMocks();

    // Re-wire implementations after clearAllMocks.
    passwordValidation.validatePassword.mockReturnValue({ isValid: true, errors: [] });
    passwordValidation.hashPassword.mockResolvedValue('new-hashed');
    passwordValidation.verifyPassword.mockResolvedValue(true);

    sessionManagement.getUserSessions.mockResolvedValue([...activeSessions]);
    sessionManagement.revokeAllUserSessions.mockImplementation(async () => {
      activeSessions.forEach((s) => revokedSessions.add(s.id));
      return activeSessions.length;
    });
    sessionManagement.revokeAllUserSessionsExcept.mockImplementation(
      async (_userId: string, excludeId: string) => {
        const toRevoke = activeSessions
          .filter((s) => s.id !== excludeId)
          .map((s) => s.id);
        toRevoke.forEach((id) => revokedSessions.add(id));
        return toRevoke;
      },
    );
    refreshTokenStore.revokeSessionIds.mockImplementation(async (ids: string[]) => {
      ids.forEach((id) => revokedRedisKeys.add(id));
    });

    userRepo.findOne.mockResolvedValue({ ...baseUser });
    auditLog.log.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // changePassword
  // -------------------------------------------------------------------------

  describe('POST /auth/change-password', () => {
    const body = {
      currentPassword: 'OldP@ss12345!',
      newPassword: 'NewP@ss12345!',
      confirmPassword: 'NewP@ss12345!',
    };

    it('succeeds with 201', async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('x-session-id', SESSION_A)
        .set('x-user-id', USER_ID)
        .send(body)
        .expect(201);
    });

    it("revokes device B's session but NOT device A's (the acting session)", async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('x-session-id', SESSION_A)
        .set('x-user-id', USER_ID)
        .send(body)
        .expect(201);

      // The service must have been asked to revoke all sessions except the caller's.
      expect(sessionManagement.revokeAllUserSessionsExcept).toHaveBeenCalledWith(
        USER_ID,
        SESSION_A,
      );

      // Device B's session is revoked.
      expect(revokedSessions.has(SESSION_B)).toBe(true);

      // Device A's session is NOT revoked.
      expect(revokedSessions.has(SESSION_A)).toBe(false);
    });

    it("wipes device B's Redis refresh-token key", async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('x-session-id', SESSION_A)
        .set('x-user-id', USER_ID)
        .send(body)
        .expect(201);

      expect(revokedRedisKeys.has(SESSION_B)).toBe(true);
      expect(revokedRedisKeys.has(SESSION_A)).toBe(false);
    });

    it('records sessionsRevoked in the audit log', async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('x-session-id', SESSION_A)
        .set('x-user-id', USER_ID)
        .send(body)
        .expect(201);

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_CHANGE',
          metadata: expect.objectContaining({ sessionsRevoked: 1, success: true }),
        }),
      );
    });

    it('does not revoke sessions when the current password is wrong', async () => {
      passwordValidation.verifyPassword.mockResolvedValue(false);

      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('x-session-id', SESSION_A)
        .set('x-user-id', USER_ID)
        .send(body)
        .expect(401);

      expect(sessionManagement.revokeAllUserSessionsExcept).not.toHaveBeenCalled();
      expect(refreshTokenStore.revokeSessionIds).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // resetPassword
  // -------------------------------------------------------------------------

  describe('POST /auth/reset-password', () => {
    const { createHash } = require('crypto');
    const RAW_TOKEN =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const HASHED_TOKEN = createHash('sha256').update(RAW_TOKEN).digest('hex');

    beforeEach(() => {
      const queryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...baseUser,
          passwordResetToken: HASHED_TOKEN,
          passwordResetTokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        }),
      };
      userRepo.createQueryBuilder.mockReturnValue(queryBuilder);
    });

    it('succeeds with 201', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: RAW_TOKEN, newPassword: 'NewP@ss12345!' })
        .expect(201);
    });

    it('revokes ALL sessions for the user', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: RAW_TOKEN, newPassword: 'NewP@ss12345!' })
        .expect(201);

      expect(sessionManagement.revokeAllUserSessions).toHaveBeenCalledWith(USER_ID);
      expect(revokedSessions.has(SESSION_A)).toBe(true);
      expect(revokedSessions.has(SESSION_B)).toBe(true);
    });

    it('wipes Redis refresh-token keys for all sessions', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: RAW_TOKEN, newPassword: 'NewP@ss12345!' })
        .expect(201);

      expect(revokedRedisKeys.has(SESSION_A)).toBe(true);
      expect(revokedRedisKeys.has(SESSION_B)).toBe(true);
    });

    it('records sessionsRevoked in the audit log', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: RAW_TOKEN, newPassword: 'NewP@ss12345!' })
        .expect(201);

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_RESET_COMPLETED',
          metadata: expect.objectContaining({ sessionsRevoked: 2, success: true }),
        }),
      );
    });

    it('does not revoke sessions when the token has expired', async () => {
      const expiredQueryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...baseUser,
          passwordResetToken: HASHED_TOKEN,
          passwordResetTokenExpiresAt: new Date(Date.now() - 1000), // expired
        }),
      };
      userRepo.createQueryBuilder.mockReturnValue(expiredQueryBuilder);

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: RAW_TOKEN, newPassword: 'NewP@ss12345!' })
        .expect(400);

      expect(sessionManagement.revokeAllUserSessions).not.toHaveBeenCalled();
      expect(refreshTokenStore.revokeSessionIds).not.toHaveBeenCalled();
    });
  });
});
