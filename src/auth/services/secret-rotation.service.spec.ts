import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SecretRotationService } from './secret-rotation.service';

const SECRET_V1 = 'a'.repeat(32);
const SECRET_V2 = 'b'.repeat(32);

function makeModule(secret = SECRET_V1, version = 'v1') {
  return Test.createTestingModule({
    providers: [
      SecretRotationService,
      {
        provide: ConfigService,
        useValue: {
          getOrThrow: jest.fn().mockReturnValue(secret),
          get: jest.fn((key: string, def?: string) => (key === 'JWT_SECRET_VERSION' ? version : def)),
        },
      },
      {
        provide: JwtService,
        useValue: new JwtService({}),
      },
      {
        provide: EventEmitter2,
        useValue: { emit: jest.fn() },
      },
    ],
  }).compile();
}

describe('SecretRotationService', () => {
  let service: SecretRotationService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await makeModule();
    service = module.get(SecretRotationService);
    service.onModuleInit();
  });

  afterEach(() => module.close());

  it('initialises with the configured secret and version', () => {
    expect(service.activeVersion).toBe('v1');
    const status = service.status();
    expect(status).toHaveLength(1);
    expect(status[0]).toMatchObject({ version: 'v1', active: true });
  });

  it('signs a token verifiable with the active secret', () => {
    const token = service.sign({ userId: '123' });
    const payload = service.verify<{ userId: string }>(token);
    expect(payload?.userId).toBe('123');
  });

  it('rotates to a new secret and updates activeVersion', () => {
    service.rotateJwtSecret(SECRET_V2, 'v2');
    expect(service.activeVersion).toBe('v2');
    const status = service.status();
    expect(status).toHaveLength(2);
    expect(status[0]).toMatchObject({ version: 'v2', active: true });
    expect(status[1]).toMatchObject({ version: 'v1', active: false });
  });

  it('tokens signed with old key are still valid immediately after rotation', () => {
    const oldToken = service.sign({ userId: 'old' });
    service.rotateJwtSecret(SECRET_V2, 'v2');
    // old-key token must still verify — this is the acceptance-criteria assertion
    const payload = service.verify<{ userId: string }>(oldToken);
    expect(payload?.userId).toBe('old');
  });

  it('tokens signed after rotation verify with the new secret', () => {
    service.rotateJwtSecret(SECRET_V2, 'v2');
    const newToken = service.sign({ userId: 'new' });
    const payload = service.verify<{ userId: string }>(newToken);
    expect(payload?.userId).toBe('new');
  });

  it('returns null for a completely invalid token', () => {
    expect(service.verify('not.a.token')).toBeNull();
  });

  it('rejects a secret shorter than 32 characters', () => {
    expect(() => service.rotateJwtSecret('short', 'v2')).toThrow(
      'JWT secret must be at least 32 characters',
    );
  });

  it('rejects a duplicate version label', () => {
    expect(() => service.rotateJwtSecret(SECRET_V2, 'v1')).toThrow(
      'Secret version "v1" is already loaded',
    );
  });

  it('keeps only two slots after multiple rotations', () => {
    service.rotateJwtSecret(SECRET_V2, 'v2');
    service.rotateJwtSecret('c'.repeat(32), 'v3');
    expect(service.status()).toHaveLength(2);
    expect(service.activeVersion).toBe('v3');
  });

  it('retired slot is pruned after 1-hour TTL', () => {
    jest.useFakeTimers();
    service.rotateJwtSecret(SECRET_V2, 'v2');

    // Advance past the 1-hour window
    jest.advanceTimersByTime(61 * 60 * 1000);

    // Old-key token should no longer verify
    const jwtSvc: JwtService = module.get(JwtService);
    const staleToken = jwtSvc.sign({ userId: 'stale' }, { secret: SECRET_V1 });
    expect(service.verify(staleToken)).toBeNull();

    jest.useRealTimers();
  });

  it('old secret expiresAt is set approximately 1 hour after rotation', () => {
    const before = new Date();
    service.rotateJwtSecret(SECRET_V2, 'v2');
    const after = new Date();

    const statuses = service.status();
    const retiredSlot = statuses.find((s) => s.version === 'v1');
    expect(retiredSlot?.expiresAt).toBeDefined();

    const ttl = retiredSlot!.expiresAt!.getTime();
    expect(ttl).toBeGreaterThanOrEqual(before.getTime() + 60 * 60 * 1000 - 100);
    expect(ttl).toBeLessThanOrEqual(after.getTime() + 60 * 60 * 1000 + 100);
  });

  describe('rotateDatabaseCredentials', () => {
    const v1Creds = {
      version: 'db-v1',
      host: 'db.example.com',
      port: 5432,
      username: 'app',
      password: 'primary-password-secure',
      database: 'healthystellar',
    };

    it('sets active DB credentials', () => {
      service.rotateDatabaseCredentials(v1Creds);
      expect(service.activeDbCredentials?.version).toBe('db-v1');
    });

    it('retains previous credentials in drain window', () => {
      service.rotateDatabaseCredentials(v1Creds);
      service.rotateDatabaseCredentials({ ...v1Creds, version: 'db-v2', password: 'new-pw-secure' });
      const all = service.allDbCredentials;
      expect(all).toHaveLength(2);
      expect(all[0].version).toBe('db-v2');
      expect(all[1].version).toBe('db-v1');
    });

    it('rejects missing password', () => {
      expect(() =>
        service.rotateDatabaseCredentials({ ...v1Creds, password: '' }),
      ).toThrow('Database username and password are required');
    });
  });
});
