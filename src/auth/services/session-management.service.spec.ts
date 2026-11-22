/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { SessionManagementService } from './session-management.service';
import { SessionRevocationService } from './session-revocation.service';
import { SessionEntity } from '../entities/session.entity';
import { User } from '../entities/user.entity';

describe('SessionManagementService', () => {
  let service: SessionManagementService;
  let sessionRepository: jest.Mocked<Repository<SessionEntity>>;
  let configService: jest.Mocked<ConfigService>;
  let sessionRevocationService: jest.Mocked<SessionRevocationService>;

  const createMockSession = (overrides?: Partial<SessionEntity>): SessionEntity => {
    const session = new SessionEntity();
    session.id = 'session-123';
    session.userId = 'user-456';
    session.accessTokenHash = 'hash-at';
    session.refreshTokenHash = 'hash-rt';
    session.isActive = true;
    session.createdAt = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    session.updatedAt = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago (active)
    session.expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes in future
    session.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days in future
    session.ipAddress = '127.0.0.1';
    session.userAgent = 'JestTest';
    session.deviceId = 'device-1';
    return Object.assign(session, overrides);
  };

  beforeEach(async () => {
    const mockSessionRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };

    const mockUserRepo = {
      findOne: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'SESSION_TIMEOUT_MINUTES' || key === 'session_timeout_minutes') {
          return 15;
        }
        if (key === 'SESSION_ACTIVITY_THROTTLE_MS') {
          return 60_000;
        }
        if (key === 'MAX_SESSIONS_PER_USER') {
          return 5;
        }
        return defaultValue;
      }),
    };

    const mockRevocationService = {
      notifySessionRevoked: jest.fn().mockResolvedValue(undefined),
      notifyUserSessionsRevoked: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionManagementService,
        {
          provide: getRepositoryToken(SessionEntity),
          useValue: mockSessionRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SessionRevocationService,
          useValue: mockRevocationService,
        },
      ],
    }).compile();

    service = module.get<SessionManagementService>(SessionManagementService);
    sessionRepository = module.get(getRepositoryToken(SessionEntity));
    configService = module.get(ConfigService);
    sessionRevocationService = module.get(SessionRevocationService);
  });

  describe('isSessionValid (#1191 inactivity timeout)', () => {
    it('should return true for an active session with recent activity within 15 minutes', async () => {
      const session = createMockSession({
        updatedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
      });
      sessionRepository.findOne.mockResolvedValue(session);

      const isValid = await service.isSessionValid(session.id);

      expect(isValid).toBe(true);
      expect(sessionRepository.findOne).toHaveBeenCalledWith({ where: { id: session.id } });
      expect(sessionRepository.save).not.toHaveBeenCalled();
    });

    it('should return false and revoke session when idle > 15 minutes', async () => {
      const session = createMockSession({
        updatedAt: new Date(Date.now() - 16 * 60 * 1000), // 16 min ago (> 15m)
      });
      sessionRepository.findOne.mockResolvedValue(session);

      const isValid = await service.isSessionValid(session.id);

      expect(isValid).toBe(false);
      expect(session.isActive).toBe(false);
      expect(session.revokedAt).toBeInstanceOf(Date);
      expect(sessionRepository.save).toHaveBeenCalledWith(session);
      expect(sessionRevocationService.notifySessionRevoked).toHaveBeenCalledWith(session.id);
    });

    it('should return false if session does not exist', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      const isValid = await service.isSessionValid('non-existent');

      expect(isValid).toBe(false);
    });

    it('should return false if session is already inactive', async () => {
      const session = createMockSession({ isActive: false });
      sessionRepository.findOne.mockResolvedValue(session);

      const isValid = await service.isSessionValid(session.id);

      expect(isValid).toBe(false);
      expect(sessionRepository.save).not.toHaveBeenCalled();
    });

    it('should return false and revoke if expiresAt has passed', async () => {
      const session = createMockSession({
        expiresAt: new Date(Date.now() - 1000), // expired
      });
      sessionRepository.findOne.mockResolvedValue(session);

      const isValid = await service.isSessionValid(session.id);

      expect(isValid).toBe(false);
      expect(session.isActive).toBe(false);
      expect(session.revokedAt).toBeInstanceOf(Date);
      expect(sessionRepository.save).toHaveBeenCalledWith(session);
      expect(sessionRevocationService.notifySessionRevoked).toHaveBeenCalledWith(session.id);
    });

    it('should respect custom inactivity timeout configured via ConfigService', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'SESSION_TIMEOUT_MINUTES') return 30; // 30 minutes
        return defaultValue;
      });

      const session = createMockSession({
        updatedAt: new Date(Date.now() - 20 * 60 * 1000), // 20 min ago (< 30 min)
      });
      sessionRepository.findOne.mockResolvedValue(session);

      const isValid = await service.isSessionValid(session.id);

      expect(isValid).toBe(true);
    });
  });

  describe('refreshSession (#1191 refuse refresh for idle sessions)', () => {
    it('should succeed and refresh tokens when session is active and not idle', async () => {
      const session = createMockSession({
        updatedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
      });
      sessionRepository.findOne.mockResolvedValue(session);

      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';
      const newExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const newRefreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const refreshed = await service.refreshSession(
        session.id,
        newAccessToken,
        newRefreshToken,
        newExpiresAt,
        newRefreshExpiresAt,
      );

      expect(refreshed.expiresAt).toEqual(newExpiresAt);
      expect(refreshed.refreshTokenExpiresAt).toEqual(newRefreshExpiresAt);
      expect(sessionRepository.save).toHaveBeenCalled();
    });

    it('should refuse refresh and throw UnauthorizedException when session is idle > 15 minutes', async () => {
      const session = createMockSession({
        updatedAt: new Date(Date.now() - 25 * 60 * 1000), // 25 min ago (> 15m)
      });
      sessionRepository.findOne.mockResolvedValue(session);

      await expect(
        service.refreshSession(session.id, 'new-at', 'new-rt', new Date(), new Date()),
      ).rejects.toThrow(new UnauthorizedException('Session expired due to inactivity'));

      expect(session.isActive).toBe(false);
      expect(session.revokedAt).toBeInstanceOf(Date);
      expect(sessionRepository.save).toHaveBeenCalledWith(session);
      expect(sessionRevocationService.notifySessionRevoked).toHaveBeenCalledWith(session.id);
    });

    it('should throw UnauthorizedException if session is not found', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.refreshSession('missing-id', 'at', 'rt', new Date(), new Date()),
      ).rejects.toThrow(new UnauthorizedException('Session not found'));
    });

    it('should throw UnauthorizedException if session is inactive', async () => {
      const session = createMockSession({ isActive: false });
      sessionRepository.findOne.mockResolvedValue(session);

      await expect(
        service.refreshSession(session.id, 'at', 'rt', new Date(), new Date()),
      ).rejects.toThrow(new UnauthorizedException('Session is not active'));
    });

    it('should throw UnauthorizedException if refresh token is expired', async () => {
      const session = createMockSession({
        refreshTokenExpiresAt: new Date(Date.now() - 1000),
      });
      sessionRepository.findOne.mockResolvedValue(session);

      await expect(
        service.refreshSession(session.id, 'at', 'rt', new Date(), new Date()),
      ).rejects.toThrow(new UnauthorizedException('Refresh token expired'));
    });
  });

  describe('enforceSessionTimeout', () => {
    it('should accept session ID string and revoke if idle', async () => {
      const session = createMockSession({
        updatedAt: new Date(Date.now() - 20 * 60 * 1000),
      });
      sessionRepository.findOne.mockResolvedValue(session);

      const result = await service.enforceSessionTimeout(session.id, 15);

      expect(result).toBe(false);
      expect(session.isActive).toBe(false);
      expect(sessionRepository.save).toHaveBeenCalledWith(session);
    });

    it('should accept SessionEntity directly without extra DB lookup', async () => {
      const session = createMockSession({
        updatedAt: new Date(Date.now() - 20 * 60 * 1000),
      });

      const result = await service.enforceSessionTimeout(session, 15);

      expect(result).toBe(false);
      expect(sessionRepository.findOne).not.toHaveBeenCalled();
      expect(sessionRepository.save).toHaveBeenCalledWith(session);
    });

    it('should fallback to createdAt if updatedAt is not set', async () => {
      const session = createMockSession({
        updatedAt: undefined as any,
        createdAt: new Date(Date.now() - 16 * 60 * 1000),
      });

      const result = await service.enforceSessionTimeout(session, 15);

      expect(result).toBe(false);
      expect(session.isActive).toBe(false);
    });
  });

  describe('updateSessionActivity (#1191 activity write throttling)', () => {
    it('should perform DB update on first call', async () => {
      const sessionId = 'session-throttle-1';

      await service.updateSessionActivity(sessionId);

      expect(sessionRepository.update).toHaveBeenCalledTimes(1);
      expect(sessionRepository.update).toHaveBeenCalledWith(
        { id: sessionId },
        { updatedAt: expect.any(Date) },
      );
    });

    it('should throttle subsequent calls within 60 seconds (no extra DB write)', async () => {
      const sessionId = 'session-throttle-2';

      await service.updateSessionActivity(sessionId);
      expect(sessionRepository.update).toHaveBeenCalledTimes(1);

      // Call immediately again (within 60s)
      await service.updateSessionActivity(sessionId);
      expect(sessionRepository.update).toHaveBeenCalledTimes(1);

      // Third call within window
      await service.updateSessionActivity(sessionId);
      expect(sessionRepository.update).toHaveBeenCalledTimes(1);
    });

    it('should perform DB update when force is true even within throttle window', async () => {
      const sessionId = 'session-throttle-3';

      await service.updateSessionActivity(sessionId);
      expect(sessionRepository.update).toHaveBeenCalledTimes(1);

      // Call with force=true
      await service.updateSessionActivity(sessionId, true);
      expect(sessionRepository.update).toHaveBeenCalledTimes(2);
    });

    it('should perform DB update after throttle period has elapsed', async () => {
      const sessionId = 'session-throttle-4';
      const now = Date.now();
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

      await service.updateSessionActivity(sessionId);
      expect(sessionRepository.update).toHaveBeenCalledTimes(1);

      // Advance time by 61 seconds (past 60s throttle window)
      dateSpy.mockReturnValue(now + 61_000);

      await service.updateSessionActivity(sessionId);
      expect(sessionRepository.update).toHaveBeenCalledTimes(2);

      dateSpy.mockRestore();
    });
  });

  describe('revokeSession', () => {
    it('should revoke session, clear throttle cache, and notify websocket service', async () => {
      const session = createMockSession();
      sessionRepository.findOne.mockResolvedValue(session);

      await service.revokeSession(session.id);

      expect(session.isActive).toBe(false);
      expect(session.revokedAt).toBeInstanceOf(Date);
      expect(sessionRepository.save).toHaveBeenCalledWith(session);
      expect(sessionRevocationService.notifySessionRevoked).toHaveBeenCalledWith(session.id);
    });

    it('should throw NotFoundException if session not found', async () => {
      sessionRepository.findOne.mockResolvedValue(null);

      await expect(service.revokeSession('not-found')).rejects.toThrow(NotFoundException);
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should revoke all active user sessions and notify websocket service', async () => {
      const s1 = createMockSession({ id: 's-1' });
      const s2 = createMockSession({ id: 's-2' });
      sessionRepository.find.mockResolvedValue([s1, s2]);

      await service.revokeAllUserSessions('user-1');

      expect(s1.isActive).toBe(false);
      expect(s2.isActive).toBe(false);
      expect(sessionRepository.save).toHaveBeenCalledWith([s1, s2]);
      expect(sessionRevocationService.notifyUserSessionsRevoked).toHaveBeenCalledWith('user-1');
    });
  });
});
