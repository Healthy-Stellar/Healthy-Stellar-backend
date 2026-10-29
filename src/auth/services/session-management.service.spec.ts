/**
 * src/auth/services/session-management.service.spec.ts
 *
 * Covers issue #1191 — the HIPAA 15-minute inactivity rule was implemented in
 * `enforceSessionTimeout()` but never enforced by anyone, so idle sessions could
 * be refreshed indefinitely and every authenticated request paid for an
 * unthrottled `UPDATE` that nothing read.
 *
 * Covered here:
 *  1. `isSessionValid()` rejects (and revokes) sessions idle beyond the window.
 *  2. The window comes from `SESSION_INACTIVITY_TIMEOUT_MINUTES` and falls back
 *     to 15 minutes when unset/invalid.
 *  3. `refreshSession()` refuses to resurrect an idle session.
 *  4. `enforceSessionTimeout()` reports idle sessions as invalid.
 *  5. `updateSessionActivity()` writes at most once per throttle window and
 *     never rejects a request when the write fails.
 */

import { UnauthorizedException } from '@nestjs/common';
import { FindOperator, LessThan } from 'typeorm';
import {
  DEFAULT_SESSION_ACTIVITY_THROTTLE_SECONDS,
  DEFAULT_SESSION_INACTIVITY_TIMEOUT_MINUTES,
  SessionManagementService,
} from './session-management.service';
import { SessionEntity } from '../entities/session.entity';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MINUTE_MS = 60 * 1000;

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * MINUTE_MS);
}

function makeSession(overrides: Partial<SessionEntity> = {}): SessionEntity {
  return {
    id: 'session-1',
    userId: 'user-1',
    accessTokenHash: 'a'.repeat(64),
    refreshTokenHash: 'b'.repeat(64),
    expiresAt: new Date(Date.now() + 15 * MINUTE_MS),
    refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * MINUTE_MS),
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    deviceId: 'device-1',
    isActive: true,
    revokedAt: null,
    createdAt: minutesAgo(120),
    updatedAt: new Date(),
    ...overrides,
  } as SessionEntity;
}

function buildService(config: Record<string, unknown> = {}) {
  const sessionRepository = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (session: SessionEntity) => session),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    create: jest.fn((value: Partial<SessionEntity>) => value),
    createQueryBuilder: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string, defaultValue?: unknown) =>
      key in config ? config[key] : defaultValue,
    ),
  };

  const sessionRevocationService = {
    notifySessionRevoked: jest.fn().mockResolvedValue(undefined),
    notifyUserSessionsRevoked: jest.fn().mockResolvedValue(undefined),
  };

  const service = new SessionManagementService(
    sessionRepository as any,
    { findOne: jest.fn(), save: jest.fn() } as any,
    configService as any,
    sessionRevocationService as any,
  );

  return { service, sessionRepository, configService, sessionRevocationService };
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Idle-timeout enforcement
// ---------------------------------------------------------------------------

describe('SessionManagementService.isSessionValid — inactivity timeout (#1191)', () => {
  it('accepts a session whose last activity is inside the window', async () => {
    const { service, sessionRepository, sessionRevocationService } = buildService();
    sessionRepository.findOne.mockResolvedValue(makeSession({ updatedAt: minutesAgo(14) }));

    await expect(service.isSessionValid('session-1')).resolves.toBe(true);
    expect(sessionRepository.save).not.toHaveBeenCalled();
    expect(sessionRevocationService.notifySessionRevoked).not.toHaveBeenCalled();
  });

  it('rejects a session idle for longer than the default 15 minutes', async () => {
    const { service, sessionRepository, sessionRevocationService } = buildService();
    const session = makeSession({ updatedAt: minutesAgo(16) });
    sessionRepository.findOne.mockResolvedValue(session);

    await expect(service.isSessionValid('session-1')).resolves.toBe(false);

    // The idle session must be revoked, not merely reported invalid.
    expect(session.isActive).toBe(false);
    expect(session.revokedAt).toBeInstanceOf(Date);
    expect(sessionRepository.save).toHaveBeenCalledWith(session);
    // Open sockets for the idle session are dropped.
    expect(sessionRevocationService.notifySessionRevoked).toHaveBeenCalledWith('session-1');
  });

  it('still accepts a session that is one second short of the limit', async () => {
    const { service, sessionRepository } = buildService();
    sessionRepository.findOne.mockResolvedValue(
      makeSession({
        updatedAt: new Date(
          Date.now() - DEFAULT_SESSION_INACTIVITY_TIMEOUT_MINUTES * MINUTE_MS + 1000,
        ),
      }),
    );

    await expect(service.isSessionValid('session-1')).resolves.toBe(true);
    expect(sessionRepository.save).not.toHaveBeenCalled();
  });

  it('honours SESSION_INACTIVITY_TIMEOUT_MINUTES from configuration', async () => {
    const { service, sessionRepository } = buildService({
      SESSION_INACTIVITY_TIMEOUT_MINUTES: 5,
    });

    sessionRepository.findOne.mockResolvedValue(makeSession({ updatedAt: minutesAgo(6) }));
    await expect(service.isSessionValid('session-1')).resolves.toBe(false);

    sessionRepository.findOne.mockResolvedValue(makeSession({ updatedAt: minutesAgo(4) }));
    await expect(service.isSessionValid('session-1')).resolves.toBe(true);
  });

  it('accepts a numeric string from the environment', async () => {
    const { service, sessionRepository } = buildService({
      SESSION_INACTIVITY_TIMEOUT_MINUTES: '30',
    });

    sessionRepository.findOne.mockResolvedValue(makeSession({ updatedAt: minutesAgo(20) }));
    await expect(service.isSessionValid('session-1')).resolves.toBe(true);
  });

  it('falls back to the HIPAA default when the configured value is invalid', async () => {
    const { service, sessionRepository } = buildService({
      SESSION_INACTIVITY_TIMEOUT_MINUTES: 'not-a-number',
    });

    sessionRepository.findOne.mockResolvedValue(makeSession({ updatedAt: minutesAgo(16) }));
    await expect(service.isSessionValid('session-1')).resolves.toBe(false);

    sessionRepository.findOne.mockResolvedValue(makeSession({ updatedAt: minutesAgo(14) }));
    await expect(service.isSessionValid('session-1')).resolves.toBe(true);
  });

  it('still rejects missing, revoked and expired sessions', async () => {
    const { service, sessionRepository } = buildService();

    sessionRepository.findOne.mockResolvedValue(null);
    await expect(service.isSessionValid('missing')).resolves.toBe(false);

    sessionRepository.findOne.mockResolvedValue(makeSession({ isActive: false }));
    await expect(service.isSessionValid('revoked')).resolves.toBe(false);

    sessionRepository.findOne.mockResolvedValue(makeSession({ expiresAt: minutesAgo(1) }));
    await expect(service.isSessionValid('expired')).resolves.toBe(false);
    expect(sessionRepository.save).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Refresh must not revive an idle session
// ---------------------------------------------------------------------------

describe('SessionManagementService.refreshSession — inactivity timeout (#1191)', () => {
  const rotationArgs = () =>
    [
      'session-1',
      'new-access-token',
      'new-refresh-token',
      new Date(Date.now() + 15 * MINUTE_MS),
      new Date(Date.now() + 7 * 24 * 60 * MINUTE_MS),
    ] as const;

  it('throws UnauthorizedException and revokes an idle session', async () => {
    const { service, sessionRepository, sessionRevocationService } = buildService();
    const session = makeSession({ updatedAt: minutesAgo(45) });
    sessionRepository.findOne.mockResolvedValue(session);

    await expect(service.refreshSession(...rotationArgs())).rejects.toThrow(UnauthorizedException);

    expect(session.isActive).toBe(false);
    expect(sessionRepository.save).toHaveBeenCalledWith(session);
    expect(sessionRevocationService.notifySessionRevoked).toHaveBeenCalledWith('session-1');
    // Tokens must not be rotated for a session that failed the idle check.
    expect(session.accessTokenHash).toBe('a'.repeat(64));
    expect(session.refreshTokenHash).toBe('b'.repeat(64));
  });

  it('rotates tokens for an active session', async () => {
    const { service, sessionRepository } = buildService();
    const session = makeSession({ updatedAt: minutesAgo(2) });
    sessionRepository.findOne.mockResolvedValue(session);

    await expect(service.refreshSession(...rotationArgs())).resolves.toBeDefined();

    expect(session.accessTokenHash).not.toBe('a'.repeat(64));
    expect(session.refreshTokenHash).not.toBe('b'.repeat(64));
    expect(sessionRepository.save).toHaveBeenCalledWith(session);
  });

  it('still rejects an inactive session before checking inactivity', async () => {
    const { service, sessionRepository } = buildService();
    sessionRepository.findOne.mockResolvedValue(makeSession({ isActive: false }));

    await expect(service.refreshSession(...rotationArgs())).rejects.toThrow(
      'Session is not active',
    );
  });
});

// ---------------------------------------------------------------------------
// enforceSessionTimeout — now reachable and config-aware
// ---------------------------------------------------------------------------

describe('SessionManagementService.enforceSessionTimeout (#1191)', () => {
  it('returns false and revokes a session idle beyond the configured window', async () => {
    const { service, sessionRepository } = buildService();
    const session = makeSession({ updatedAt: minutesAgo(20) });
    sessionRepository.findOne.mockResolvedValue(session);

    await expect(service.enforceSessionTimeout('session-1')).resolves.toBe(false);
    expect(session.isActive).toBe(false);
    expect(sessionRepository.save).toHaveBeenCalled();
  });

  it('returns true for a recently active session', async () => {
    const { service, sessionRepository } = buildService();
    sessionRepository.findOne.mockResolvedValue(makeSession({ updatedAt: minutesAgo(1) }));

    await expect(service.enforceSessionTimeout('session-1')).resolves.toBe(true);
    expect(sessionRepository.save).not.toHaveBeenCalled();
  });

  it('accepts an explicit inactivity override', async () => {
    const { service, sessionRepository } = buildService();
    sessionRepository.findOne.mockResolvedValue(makeSession({ updatedAt: minutesAgo(10) }));

    await expect(service.enforceSessionTimeout('session-1', 60)).resolves.toBe(true);
    await expect(service.enforceSessionTimeout('session-1', 5)).resolves.toBe(false);
  });

  it('returns false for unknown and already-inactive sessions without writing', async () => {
    const { service, sessionRepository } = buildService();

    sessionRepository.findOne.mockResolvedValue(null);
    await expect(service.enforceSessionTimeout('missing')).resolves.toBe(false);

    sessionRepository.findOne.mockResolvedValue(makeSession({ isActive: false }));
    await expect(service.enforceSessionTimeout('revoked')).resolves.toBe(false);

    expect(sessionRepository.save).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Activity-write throttling
// ---------------------------------------------------------------------------

describe('SessionManagementService.updateSessionActivity — throttled writes (#1191)', () => {
  it('writes at most once per throttle window, even for repeated requests', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    const base = 1_700_000_000_000;

    const { service, sessionRepository } = buildService();

    nowSpy.mockReturnValue(base);
    await service.updateSessionActivity('session-1');
    expect(sessionRepository.update).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(base + 30_000);
    await service.updateSessionActivity('session-1');
    expect(sessionRepository.update).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(base + 59_999);
    await service.updateSessionActivity('session-1');
    expect(sessionRepository.update).toHaveBeenCalledTimes(1);

    // Once the window has elapsed a new write is allowed.
    nowSpy.mockReturnValue(base + DEFAULT_SESSION_ACTIVITY_THROTTLE_SECONDS * 1000);
    await service.updateSessionActivity('session-1');
    expect(sessionRepository.update).toHaveBeenCalledTimes(2);
  });

  it('guards the UPDATE with an updatedAt predicate so the clock cannot go backwards', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    const base = 1_700_000_000_000;
    nowSpy.mockReturnValue(base);

    const { service, sessionRepository } = buildService();
    await service.updateSessionActivity('session-1');

    const [criteria, values] = sessionRepository.update.mock.calls[0];

    expect(criteria.id).toBe('session-1');
    expect(criteria.updatedAt).toBeInstanceOf(FindOperator);
    expect((criteria.updatedAt as FindOperator<Date>).type).toBe('lessThan');
    expect((criteria.updatedAt as FindOperator<Date>).value).toEqual(
      new Date(base - DEFAULT_SESSION_ACTIVITY_THROTTLE_SECONDS * 1000),
    );
    expect(values).toEqual({ updatedAt: new Date(base) });
  });

  it('tracks each session independently', async () => {
    const { service, sessionRepository } = buildService();

    await service.updateSessionActivity('session-1');
    await service.updateSessionActivity('session-2');
    await service.updateSessionActivity('session-1');

    expect(sessionRepository.update).toHaveBeenCalledTimes(2);
  });

  it('writes on every call when throttling is disabled with 0', async () => {
    const { service, sessionRepository } = buildService({
      SESSION_ACTIVITY_WRITE_THROTTLE_SECONDS: 0,
    });

    await service.updateSessionActivity('session-1');
    await service.updateSessionActivity('session-1');

    expect(sessionRepository.update).toHaveBeenCalledTimes(2);
    expect(sessionRepository.update.mock.calls[0][0]).toEqual({ id: 'session-1' });
  });

  it('honours a custom throttle window from configuration', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    const base = 1_700_000_000_000;
    nowSpy.mockReturnValue(base);

    const { service, sessionRepository } = buildService({
      SESSION_ACTIVITY_WRITE_THROTTLE_SECONDS: 5,
    });

    await service.updateSessionActivity('session-1');
    nowSpy.mockReturnValue(base + 4_000);
    await service.updateSessionActivity('session-1');
    expect(sessionRepository.update).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(base + 5_000);
    await service.updateSessionActivity('session-1');
    expect(sessionRepository.update).toHaveBeenCalledTimes(2);
  });

  it('never rejects the request when the activity write fails', async () => {
    const { service, sessionRepository } = buildService();
    sessionRepository.update.mockRejectedValue(new Error('connection terminated'));

    await expect(service.updateSessionActivity('session-1')).resolves.toBeUndefined();
  });

  it('retries after a failed write instead of caching the failure', async () => {
    const { service, sessionRepository } = buildService();
    sessionRepository.update.mockRejectedValueOnce(new Error('connection terminated'));

    await service.updateSessionActivity('session-1');
    await service.updateSessionActivity('session-1');

    expect(sessionRepository.update).toHaveBeenCalledTimes(2);
  });
});
