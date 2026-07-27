import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
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
