import { UnauthorizedException } from '@nestjs/common';
import { SessionManagementService } from './session-management.service';

const SESSION_ID = '0b9e5c1e-4c55-4f39-9b51-2a1f9a3d1c11';

function build() {
  const sessionRepository = {
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn(async (entity) => entity),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const configService = { get: jest.fn((_key: string, fallback?: unknown) => fallback) };
  const revocation = {
    notifySessionRevoked: jest.fn().mockResolvedValue(undefined),
    notifyUserSessionsRevoked: jest.fn().mockResolvedValue(undefined),
  };
  const service = new SessionManagementService(
    sessionRepository as any,
    {} as any,
    configService as any,
    revocation as any,
  );
  return { service, sessionRepository };
}

describe('SessionManagementService', () => {
  describe('createSession (#1323)', () => {
    it('persists the caller-supplied id so it matches the JWT sessionId', async () => {
      const { service, sessionRepository } = build();

      await service.createSession('user-1', 'at', 'rt', new Date(), new Date(), 'ip', 'ua', undefined, {
        id: SESSION_ID,
      });

      expect(sessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: SESSION_ID, mfaVerified: false }),
      );
    });

    it('generates a UUID id when none is supplied', async () => {
      const { service, sessionRepository } = build();

      await service.createSession('user-1', 'at', 'rt', new Date(), new Date(), 'ip', 'ua');

      const { id } = sessionRepository.create.mock.calls[0][0];
      expect(service.isWellFormedSessionId(id)).toBe(true);
    });

    it('refuses a non-UUID id rather than letting Postgres reject it later', async () => {
      const { service } = build();

      await expect(
        service.createSession('user-1', 'at', 'rt', new Date(), new Date(), 'ip', 'ua', undefined, {
          id: 'a'.repeat(32),
        }),
      ).rejects.toThrow('Session id must be a UUID');
    });

    it('stores a placeholder refresh hash when no refresh token is issued', async () => {
      const { service, sessionRepository } = build();

      await service.createSession('user-1', 'at', null, new Date(), new Date(), 'ip', 'ua');

      expect(sessionRepository.create.mock.calls[0][0].refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('lookups with a malformed session id', () => {
    it('never query the database', async () => {
      const { service, sessionRepository } = build();
      const legacyHexId = 'deadbeef'.repeat(4);

      await expect(service.isSessionValid(legacyHexId)).resolves.toBe(false);
      await expect(service.getSession(legacyHexId)).resolves.toBeNull();
      await expect(service.updateSessionActivity(legacyHexId)).resolves.toBeUndefined();
      await expect(service.revokeSession(legacyHexId)).rejects.toThrow('Session not found');
      await expect(service.getRefreshableSession(legacyHexId, 'user-1')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(sessionRepository.findOne).not.toHaveBeenCalled();
      expect(sessionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('getRefreshableSession (#1322)', () => {
    const future = () => new Date(Date.now() + 60_000);

    it('returns the session including its recorded MFA state', async () => {
      const { service, sessionRepository } = build();
      const row = { id: SESSION_ID, userId: 'user-1', isActive: true, mfaVerified: true, refreshTokenExpiresAt: future() };
      sessionRepository.findOne.mockResolvedValue(row);

      await expect(service.getRefreshableSession(SESSION_ID, 'user-1')).resolves.toBe(row);
    });

    it.each([
      ['belongs to another user', { userId: 'user-2', isActive: true, refreshTokenExpiresAt: new Date(Date.now() + 60_000) }],
      ['is revoked', { userId: 'user-1', isActive: false, refreshTokenExpiresAt: new Date(Date.now() + 60_000) }],
      ['has an expired refresh token', { userId: 'user-1', isActive: true, refreshTokenExpiresAt: new Date(Date.now() - 1) }],
    ])('rejects a session that %s', async (_label, row) => {
      const { service, sessionRepository } = build();
      sessionRepository.findOne.mockResolvedValue({ id: SESSION_ID, ...row });

      await expect(service.getRefreshableSession(SESSION_ID, 'user-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('completeMfaChallenge (#1322)', () => {
    it('marks the session verified and rotates its token hashes', async () => {
      const { service, sessionRepository } = build();
      sessionRepository.findOne.mockResolvedValue({
        id: SESSION_ID,
        userId: 'user-1',
        isActive: true,
        mfaVerified: false,
        accessTokenHash: 'old',
        refreshTokenHash: 'old',
        expiresAt: new Date(Date.now() + 60_000),
      });

      const saved = await service.completeMfaChallenge(SESSION_ID, 'user-1', 'at', 'rt', new Date(), new Date());

      expect(saved.mfaVerified).toBe(true);
      expect(saved.accessTokenHash).not.toBe('old');
      expect(saved.refreshTokenHash).not.toBe('old');
    });

    it('rejects an expired pending session', async () => {
      const { service, sessionRepository } = build();
      sessionRepository.findOne.mockResolvedValue({
        id: SESSION_ID,
        userId: 'user-1',
        isActive: true,
        expiresAt: new Date(Date.now() - 1),
      });

      await expect(
        service.completeMfaChallenge(SESSION_ID, 'user-1', 'at', 'rt', new Date(), new Date()),
      ).rejects.toThrow(UnauthorizedException);
      expect(sessionRepository.save).not.toHaveBeenCalled();
    });
  });
});
