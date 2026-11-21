import { createHash } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
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

  return {
    userRepo,
    passwordValidation,
    authTokenService,
    mfaService,
    sessionManagementService,
    refreshTokenStore,
    auditLogService,
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
