import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { AuthTokenService } from '../services/auth-token.service';
import { SessionManagementService } from '../services/session-management.service';
import { RefreshTokenStoreService } from '../services/refresh-token-store.service';
import { MfaService } from '../services/mfa.service';
import { UserRole } from '../entities/user.entity';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: UserRole.PATIENT,
  mfaEnabled: false,
  isActive: true,
  firstName: 'Test',
  lastName: 'User',
};

const mockTokens = {
  accessToken: 'new-access-token',
  refreshToken: 'new-refresh-token',
  expiresIn: 900,
  refreshExpiresIn: 604800,
};

const mockSession = {
  id: 'session-1',
  userId: 'user-1',
  isActive: true,
};

function buildMocks() {
  const authService = {
    getUserById: jest.fn().mockResolvedValue(mockUser),
    logout: jest.fn().mockResolvedValue(undefined),
    register: jest.fn(),
    login: jest.fn(),
  };

  const authTokenService = {
    verifyRefreshToken: jest.fn().mockReturnValue({
      userId: 'user-1',
      sessionId: 'session-1',
      type: 'refresh',
    }),
    generateTokenPair: jest.fn().mockReturnValue(mockTokens),
  };

  const sessionManagementService = {
    refreshSession: jest.fn().mockResolvedValue(undefined),
    getUserSessions: jest.fn().mockResolvedValue([mockSession]),
    revokeSession: jest.fn().mockResolvedValue(undefined),
  };

  const refreshTokenStore = {
    consumeAndValidate: jest.fn().mockResolvedValue(undefined),
    store: jest.fn().mockResolvedValue(undefined),
    revokeSession: jest.fn().mockResolvedValue(undefined),
  };

  const mfaService = { isMfaEnabled: jest.fn().mockResolvedValue(false) };

  return { authService, authTokenService, sessionManagementService, refreshTokenStore, mfaService };
}

async function buildController(overrides: Partial<ReturnType<typeof buildMocks>> = {}) {
  const mocks = { ...buildMocks(), ...overrides };

  const module: TestingModule = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: mocks.authService },
      { provide: AuthTokenService, useValue: mocks.authTokenService },
      { provide: SessionManagementService, useValue: mocks.sessionManagementService },
      { provide: RefreshTokenStoreService, useValue: mocks.refreshTokenStore },
      { provide: MfaService, useValue: mocks.mfaService },
    ],
  }).compile();

  return { controller: module.get(AuthController), mocks };
}

describe('POST /auth/refresh', () => {
  it('returns new accessToken and refreshToken on valid token', async () => {
    const { controller } = await buildController();

    const result = await controller.refreshToken({ refreshToken: 'valid-token' });

    expect(result).toEqual({
      accessToken: mockTokens.accessToken,
      refreshToken: mockTokens.refreshToken,
      expiresIn: mockTokens.expiresIn,
    });
  });

  it('stores the new refresh token in Redis after rotation', async () => {
    const { controller, mocks } = await buildController();

    await controller.refreshToken({ refreshToken: 'valid-token' });

    expect(mocks.refreshTokenStore.store).toHaveBeenCalledWith(
      'session-1',
      mockTokens.refreshToken,
    );
  });

  it('calls consumeAndValidate before issuing new tokens', async () => {
    const { controller, mocks } = await buildController();

    await controller.refreshToken({ refreshToken: 'valid-token' });

    expect(mocks.refreshTokenStore.consumeAndValidate).toHaveBeenCalledWith(
      'session-1',
      'valid-token',
    );
    // consumeAndValidate must happen before generateTokenPair
    const consumeOrder = mocks.refreshTokenStore.consumeAndValidate.mock.invocationCallOrder[0];
    const generateOrder = mocks.authTokenService.generateTokenPair.mock.invocationCallOrder[0];
    expect(consumeOrder).toBeLessThan(generateOrder);
  });

  it('throws BadRequestException when JWT signature is invalid', async () => {
    const { controller, mocks } = await buildController();
    mocks.authTokenService.verifyRefreshToken.mockReturnValue(null);

    await expect(controller.refreshToken({ refreshToken: 'bad-token' })).rejects.toThrow(
      BadRequestException,
    );
    expect(mocks.refreshTokenStore.consumeAndValidate).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when token type is not "refresh"', async () => {
    const { controller, mocks } = await buildController();
    mocks.authTokenService.verifyRefreshToken.mockReturnValue({
      userId: 'user-1',
      sessionId: 'session-1',
      type: 'access', // wrong type
    });

    await expect(controller.refreshToken({ refreshToken: 'access-token' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('propagates UnauthorizedException from store on reuse attack', async () => {
    const { controller, mocks } = await buildController();
    mocks.refreshTokenStore.consumeAndValidate.mockRejectedValue(
      new UnauthorizedException('Refresh token reuse detected — session revoked'),
    );

    await expect(controller.refreshToken({ refreshToken: 'replayed-token' })).rejects.toThrow(
      UnauthorizedException,
    );
    // New tokens must NOT be issued
    expect(mocks.authTokenService.generateTokenPair).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when user is inactive', async () => {
    const { controller, mocks } = await buildController();
    mocks.authService.getUserById.mockResolvedValue({ ...mockUser, isActive: false });

    await expect(controller.refreshToken({ refreshToken: 'valid-token' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException when user does not exist', async () => {
    const { controller, mocks } = await buildController();
    mocks.authService.getUserById.mockResolvedValue(null);

    await expect(controller.refreshToken({ refreshToken: 'valid-token' })).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('DELETE /auth/sessions', () => {
  const mockReq = (userId: string) => ({ user: { userId } } as any);

  it('revokes all sessions in DB and Redis', async () => {
    const { controller, mocks } = await buildController();

    const result = await controller.revokeAllSessionsDelete(mockReq('user-1'));

    expect(mocks.sessionManagementService.getUserSessions).toHaveBeenCalledWith('user-1');
    expect(mocks.sessionManagementService.revokeSession).toHaveBeenCalledWith('session-1');
    expect(mocks.refreshTokenStore.revokeSession).toHaveBeenCalledWith('session-1');
    expect(result).toEqual({ message: 'All sessions revoked' });
  });

  it('handles users with no active sessions gracefully', async () => {
    const { controller, mocks } = await buildController();
    mocks.sessionManagementService.getUserSessions.mockResolvedValue([]);

    const result = await controller.revokeAllSessionsDelete(mockReq('user-1'));

    expect(mocks.sessionManagementService.revokeSession).not.toHaveBeenCalled();
    expect(mocks.refreshTokenStore.revokeSession).not.toHaveBeenCalled();
    expect(result).toEqual({ message: 'All sessions revoked' });
  });
});

describe('DELETE /auth/sessions/:id', () => {
  const mockReq = (userId: string) => ({ user: { userId } } as any);

  it('revokes session in both DB and Redis store', async () => {
    const { controller, mocks } = await buildController();

    const result = await controller.deleteSession('session-1', mockReq('user-1'));

    expect(mocks.sessionManagementService.revokeSession).toHaveBeenCalledWith('session-1');
    expect(mocks.refreshTokenStore.revokeSession).toHaveBeenCalledWith('session-1');
    expect(result).toEqual({ message: 'Session terminated' });
  });

  it('throws NotFoundException when session does not belong to user', async () => {
    const { controller, mocks } = await buildController();
    mocks.sessionManagementService.getUserSessions.mockResolvedValue([]);

    await expect(controller.deleteSession('unknown-session', mockReq('user-1'))).rejects.toThrow(
      NotFoundException,
    );
    expect(mocks.sessionManagementService.revokeSession).not.toHaveBeenCalled();
    expect(mocks.refreshTokenStore.revokeSession).not.toHaveBeenCalled();
  });
});

describe('POST /auth/sessions/revoke-all', () => {
  it('revokes all sessions except current in DB and Redis', async () => {
    const otherSession = { id: 'session-2', userId: 'user-1', isActive: true };
    const { controller, mocks } = await buildController();
    mocks.sessionManagementService.getUserSessions.mockResolvedValue([mockSession, otherSession]);

    const req = { user: { userId: 'user-1' }, sessionId: 'session-1' } as any;
    const result = await controller.revokeAllSessions(req);

    // Current session (session-1) must NOT be revoked
    expect(mocks.sessionManagementService.revokeSession).not.toHaveBeenCalledWith('session-1');
    expect(mocks.refreshTokenStore.revokeSession).not.toHaveBeenCalledWith('session-1');

    // Other session (session-2) must be revoked in both stores
    expect(mocks.sessionManagementService.revokeSession).toHaveBeenCalledWith('session-2');
    expect(mocks.refreshTokenStore.revokeSession).toHaveBeenCalledWith('session-2');
    expect(result).toEqual({ message: 'All other sessions revoked' });
  });
});

describe('POST /auth/sessions/:sessionId/revoke', () => {
  it('revokes session in both DB and Redis store', async () => {
    const { controller, mocks } = await buildController();

    const result = await controller.revokeSession('session-1', { user: { userId: 'user-1' } } as any);

    expect(mocks.sessionManagementService.revokeSession).toHaveBeenCalledWith('session-1');
    expect(mocks.refreshTokenStore.revokeSession).toHaveBeenCalledWith('session-1');
    expect(result).toEqual({ message: 'Session revoked' });
  });
});
