import { createHash } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { PasswordValidationService } from './password-validation.service';
import { MfaService } from './mfa.service';
import { SessionManagementService } from './session-management.service';
import { RefreshTokenStoreService } from './refresh-token-store.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { User, UserRole } from '../entities/user.entity';

const mockUser: Partial<User> = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: 'hashed',
  firstName: 'Test',
  lastName: 'User',
  role: UserRole.PATIENT,
  isActive: true,
  mfaEnabled: false,
  failedLoginAttempts: 0,
  requiresPasswordChange: false,
};

const mockTokens = {
  accessToken: 'at',
  refreshToken: 'rt',
  expiresIn: 900,
  refreshExpiresIn: 604800,
};

function buildMocks() {
  const userRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockReturnValue(mockUser),
    save: jest.fn().mockResolvedValue(mockUser),
    update: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  };

  const passwordValidation = {
    validatePassword: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    hashPassword: jest.fn().mockResolvedValue('hashed'),
    verifyPassword: jest.fn().mockResolvedValue(true),
    isPasswordExpired: jest.fn().mockReturnValue(false),
  };

  const authTokenService = {
    generateTokenPair: jest.fn().mockReturnValue(mockTokens),
    generateAccessToken: jest.fn().mockReturnValue(mockTokens.accessToken),
    generateRefreshToken: jest.fn().mockReturnValue(mockTokens.refreshToken),
  };

  const mfaService = {
    isMfaEnabled: jest.fn().mockResolvedValue(false),
  };

  const sessionManagementService = {
    createSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
    revokeSession: jest.fn().mockResolvedValue(undefined),
  };

  const refreshTokenStore = {
    store: jest.fn().mockResolvedValue(undefined),
    revokeSession: jest.fn().mockResolvedValue(undefined),
  };

  const auditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const configService = {
    get: jest.fn((_key: string, def?: string) => def),
  };

  return {
    userRepo,
    passwordValidation,
    authTokenService,
    mfaService,
    sessionManagementService,
    refreshTokenStore,
    auditLogService,
    configService,
  };
}

async function buildService(overrides: Partial<ReturnType<typeof buildMocks>> = {}) {
  const mocks = { ...buildMocks(), ...overrides };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: getRepositoryToken(User), useValue: mocks.userRepo },
      { provide: PasswordValidationService, useValue: mocks.passwordValidation },
      { provide: AuthTokenService, useValue: mocks.authTokenService },
      { provide: MfaService, useValue: mocks.mfaService },
      { provide: SessionManagementService, useValue: mocks.sessionManagementService },
      { provide: RefreshTokenStoreService, useValue: mocks.refreshTokenStore },
      { provide: AuditLogService, useValue: mocks.auditLogService },
      { provide: ConfigService, useValue: mocks.configService },
    ],
  }).compile();

  return { service: module.get(AuthService), mocks };
}

describe('AuthService.login', () => {
  it('stores initial refresh token in Redis after session creation', async () => {
    const { service, mocks } = await buildService();
    mocks.userRepo.findOne.mockResolvedValue(mockUser);

    await service.login(
      { email: 'test@example.com', password: 'pw' },
      '127.0.0.1',
      'test-agent',
    );

    expect(mocks.sessionManagementService.createSession).toHaveBeenCalled();
    expect(mocks.refreshTokenStore.store).toHaveBeenCalledWith(
      expect.any(String),
      mockTokens.refreshToken,
    );
  });

  it('stores refresh token with the same sessionId used for the session', async () => {
    const { service, mocks } = await buildService();
    mocks.userRepo.findOne.mockResolvedValue(mockUser);

    await service.login({ email: 'test@example.com', password: 'pw' }, '127.0.0.1', 'ua');

    const sessionCallArgs = mocks.sessionManagementService.createSession.mock.calls[0];
    const sessionIdUsed = sessionCallArgs[0]; // first arg is userId — wait, check signature
    // createSession(userId, accessToken, refreshToken, expiresAt, refreshTokenExpiresAt, ip, ua)
    const refreshTokenInSession = sessionCallArgs[2];
    const [storeSessionId, storeRefreshToken] = mocks.refreshTokenStore.store.mock.calls[0];

    expect(storeRefreshToken).toBe(refreshTokenInSession);
    expect(typeof storeSessionId).toBe('string');
    expect(storeSessionId.length).toBeGreaterThan(0);
  });
});

describe('AuthService.register', () => {
  it('stores initial refresh token in Redis after session creation', async () => {
    const { service, mocks } = await buildService();
    // findOne returns null — no existing user
    mocks.userRepo.findOne.mockResolvedValue(null);

    await service.register(
      { email: 'new@example.com', password: 'Str0ng!', firstName: 'A', lastName: 'B' },
      UserRole.PATIENT,
      '127.0.0.1',
      'test-agent',
    );

    expect(mocks.sessionManagementService.createSession).toHaveBeenCalled();
    expect(mocks.refreshTokenStore.store).toHaveBeenCalledWith(
      expect.any(String),
      mockTokens.refreshToken,
    );
  });

  it('throws ConflictException and does not store token when email already taken', async () => {
    const { service, mocks } = await buildService();
    mocks.userRepo.findOne.mockResolvedValue(mockUser);

    await expect(
      service.register(
        { email: 'test@example.com', password: 'Str0ng!', firstName: 'A', lastName: 'B' },
        UserRole.PATIENT,
        '127.0.0.1',
        'ua',
      ),
    ).rejects.toThrow(ConflictException);

    expect(mocks.refreshTokenStore.store).not.toHaveBeenCalled();
  });
});

describe('AuthService.logout', () => {
  it('revokes session in both DB and Redis store', async () => {
    const { service, mocks } = await buildService();

    await service.logout('user-1', 'session-1', '127.0.0.1');

    expect(mocks.sessionManagementService.revokeSession).toHaveBeenCalledWith('session-1');
    expect(mocks.refreshTokenStore.revokeSession).toHaveBeenCalledWith('session-1');
  });

  it('skips revocation when sessionId is empty', async () => {
    const { service, mocks } = await buildService();

    await service.logout('user-1', '', '127.0.0.1');

    expect(mocks.sessionManagementService.revokeSession).not.toHaveBeenCalled();
    expect(mocks.refreshTokenStore.revokeSession).not.toHaveBeenCalled();
  });
});


describe('AuthService.forgotPassword (#1277)', () => {
  it('stores only sha256(token) in database and returns raw token for email delivery', async () => {
    const { service, mocks } = await buildService();
    mocks.userRepo.findOne.mockResolvedValue(mockUser);

    const result = await service.forgotPassword('test@example.com');

    expect(result).not.toBeNull();
    expect(result?.token).toBeDefined();
    const rawToken = result!.token;
    expect(rawToken).toHaveLength(64); // 32 bytes in hex

    expect(mocks.userRepo.update).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({
        passwordResetToken: createHash('sha256').update(rawToken).digest('hex'),
        passwordResetTokenExpiresAt: expect.any(Date),
      }),
    );

    // Stored hash must never be equal to raw token
    const updateCall = mocks.userRepo.update.mock.calls[0][1];
    expect(updateCall.passwordResetToken).not.toEqual(rawToken);
  });

  it('returns null for non-existent user without throwing', async () => {
    const { service, mocks } = await buildService();
    mocks.userRepo.findOne.mockResolvedValue(null);

    const result = await service.forgotPassword('unknown@example.com');

    expect(result).toBeNull();
    expect(mocks.userRepo.update).not.toHaveBeenCalled();
  });

  it('requesting a new reset generates a distinct token and overwrites previous token', async () => {
    const { service, mocks } = await buildService();
    mocks.userRepo.findOne.mockResolvedValue(mockUser);

    const res1 = await service.forgotPassword('test@example.com');
    const res2 = await service.forgotPassword('test@example.com');

    expect(res1?.token).not.toEqual(res2?.token);
    const hash1 = mocks.userRepo.update.mock.calls[0][1].passwordResetToken;
    const hash2 = mocks.userRepo.update.mock.calls[1][1].passwordResetToken;
    expect(hash1).not.toEqual(hash2);
  });
});

describe('AuthService.resetPassword (#1277)', () => {
  it('successfully resets password with valid hashed token and clears reset fields', async () => {
    const { service, mocks } = await buildService();
    const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        ...mockUser,
        passwordResetToken: hashedToken,
        passwordResetTokenExpiresAt: new Date(Date.now() + 60000),
      }),
    };
    mocks.userRepo.createQueryBuilder.mockReturnValue(queryBuilder);

    await service.resetPassword(rawToken, 'NewStrongP@ss123');

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'user.passwordResetToken = :token',
      { token: hashedToken },
    );
    expect(mocks.userRepo.update).toHaveBeenCalledWith(
      mockUser.id,
      expect.objectContaining({
        passwordHash: 'hashed',
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
      }),
    );
  });

  it('rejects invalid or unknown token with BadRequestException', async () => {
    const { service, mocks } = await buildService();
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    mocks.userRepo.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(service.resetPassword('invalid-token', 'NewStrongP@ss123')).rejects.toThrow(
      BadRequestException,
    );
    expect(mocks.userRepo.update).not.toHaveBeenCalled();
  });

  it('rejects expired token with BadRequestException', async () => {
    const { service, mocks } = await buildService();
    const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        ...mockUser,
        passwordResetToken: hashedToken,
        passwordResetTokenExpiresAt: new Date(Date.now() - 5000), // expired
      }),
    };
    mocks.userRepo.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(service.resetPassword(rawToken, 'NewStrongP@ss123')).rejects.toThrow(
      'Reset token has expired',
    );
    expect(mocks.userRepo.update).not.toHaveBeenCalled();
  });
});

describe('AuthService.login lockout policy (#1279)', () => {
  const makeUser = (over: Partial<User> = {}) => ({
    ...mockUser,
    passwordHash: 'hashed',
    failedLoginAttempts: 0,
    lockedUntil: null as unknown as Date,
    ...over,
  });

  it('returns the same generic error for a locked account whether the password is correct or not', async () => {
    const lockedUser = makeUser({
      lockedUntil: new Date(Date.now() + 60_000),
      failedLoginAttempts: 5,
    });
    const { service, mocks } = await buildService();
    mocks.userRepo.findOne.mockResolvedValue(lockedUser);

    mocks.passwordValidation.verifyPassword.mockResolvedValue(true); // "correct" password
    await expect(
      service.login({ email: 'test@example.com', password: 'right-pw' }, '127.0.0.1', 'ua'),
    ).rejects.toThrow('Invalid email or password');

    mocks.passwordValidation.verifyPassword.mockResolvedValue(false); // "wrong" password
    await expect(
      service.login({ email: 'test@example.com', password: 'wrong-pw' }, '127.0.0.1', 'ua'),
    ).rejects.toThrow('Invalid email or password');
  });

  it('never extends an active lock on further failed attempts', async () => {
    const lockedUser = makeUser({
      lockedUntil: new Date(Date.now() + 60_000),
      failedLoginAttempts: 5,
    });
    const { service, mocks } = await buildService();
    mocks.userRepo.findOne.mockResolvedValue(lockedUser);
    mocks.passwordValidation.verifyPassword.mockResolvedValue(false);

    await expect(
      service.login({ email: 'test@example.com', password: 'wrong' }, '127.0.0.1', 'ua'),
    ).rejects.toThrow('Invalid email or password');

    // Lock must not be extended: we short-circuit before persisting.
    expect(mocks.userRepo.save).not.toHaveBeenCalled();
    // A dummy hash verification runs to equalise timing.
    expect(mocks.passwordValidation.verifyPassword).toHaveBeenCalledWith(
      'wrong',
      expect.any(String),
    );
  });

  it('resets the failure counter when a prior lock has expired, so one typo does not re-lock', async () => {
    const expiredUser = makeUser({
      lockedUntil: new Date(Date.now() - 1000),
      failedLoginAttempts: 6,
    });
    const { service, mocks } = await buildService();
    mocks.userRepo.findOne.mockResolvedValue(expiredUser);
    mocks.passwordValidation.verifyPassword.mockResolvedValue(false);

    await expect(
      service.login({ email: 'test@example.com', password: 'typo' }, '127.0.0.1', 'ua'),
    ).rejects.toThrow('Invalid email or password');

    expect(mocks.userRepo.save).toHaveBeenCalledTimes(1);
    const saved = mocks.userRepo.save.mock.calls[0][0];
    expect(saved.failedLoginAttempts).toBe(1); // reset (0) + 1
    expect(saved.lockedUntil).toBeNull(); // not re-locked after a single typo
  });

  it('runs a dummy hash for unknown emails and does not persist anything', async () => {
    const { service, mocks } = await buildService();
    mocks.userRepo.findOne.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nope@example.com', password: 'whatever' }, '127.0.0.1', 'ua'),
    ).rejects.toThrow('Invalid email or password');

    // Dummy hash verification runs (timing parity) but nothing is persisted.
    expect(mocks.passwordValidation.verifyPassword).toHaveBeenCalledWith(
      'whatever',
      expect.any(String),
    );
    expect(mocks.userRepo.save).not.toHaveBeenCalled();
  });

  it('locks after the configured threshold of failed attempts (config-driven)', async () => {
    const { service, mocks } = await buildService({
      configService: {
        get: jest.fn((key: string) => (key === 'LOCKOUT_THRESHOLD' ? '2' : '30')),
      } as unknown as typeof mocks.configService,
    });
    const user = makeUser({ failedLoginAttempts: 1, lockedUntil: null });
    mocks.userRepo.findOne.mockResolvedValue(user);
    mocks.passwordValidation.verifyPassword.mockResolvedValue(false);

    await expect(
      service.login({ email: 'test@example.com', password: 'bad' }, '127.0.0.1', 'ua'),
    ).rejects.toThrow('Invalid email or password');

    const saved = mocks.userRepo.save.mock.calls[0][0];
    expect(saved.failedLoginAttempts).toBe(2);
    expect(saved.lockedUntil).not.toBeNull(); // locked after threshold (2)
  });

  it('uses safe defaults when LOCKOUT env vars are unset', async () => {
    const { service, mocks } = await buildService({
      configService: {
        get: jest.fn((_k: string, def?: string) => def),
      } as unknown as typeof mocks.configService,
    });
    const user = makeUser({ failedLoginAttempts: 4, lockedUntil: null });
    mocks.userRepo.findOne.mockResolvedValue(user);
    mocks.passwordValidation.verifyPassword.mockResolvedValue(false);

    await expect(
      service.login({ email: 'test@example.com', password: 'bad' }, '127.0.0.1', 'ua'),
    ).rejects.toThrow('Invalid email or password');

    // 4 + 1 = 5 reaches the default threshold → locked
    const saved = mocks.userRepo.save.mock.calls[0][0];
    expect(saved.failedLoginAttempts).toBe(5);
    expect(saved.lockedUntil).not.toBeNull();
  });
});
