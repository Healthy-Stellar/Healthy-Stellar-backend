import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import { IsNull } from 'typeorm';
import { MfaService } from './mfa.service';
import { DataEncryptionService } from '../../common/services/data-encryption.service';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<any> = {}) {
  return {
    id: 'user-1',
    email: 'patient@example.com',
    mfaSecret: null as string | null,
    mfaEnabled: false,
    ...overrides,
  };
}

function makeRecoveryCodeRecord(overrides: Partial<any> = {}) {
  return {
    id: `rc-${Math.random()}`,
    userId: 'user-1',
    codeHash: '',
    consumedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ── Factory ────────────────────────────────────────────────────────────────

function buildService(user: any, recoveryRows: any[] = []) {
  const userRepository = {
    findOne: jest.fn().mockResolvedValue(user),
    save: jest.fn().mockImplementation(async (u: any) => {
      Object.assign(user, u);
      return user;
    }),
  };

  const mfaRepository = {
    findOne: jest.fn().mockResolvedValue({
      id: 'mfa-1',
      userId: user.id,
      secret: user.mfaSecret ?? '',
      backupCodes: [],
      isActive: true,
      isPrimary: true,
      lastUsedAt: null,
      save: jest.fn(),
    }),
    create: jest.fn().mockImplementation((d: any) => d),
    save: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const recoveryCodeRepository = {
    find: jest.fn().mockResolvedValue(recoveryRows),
    count: jest.fn().mockResolvedValue(recoveryRows.filter((r) => !r.consumedAt).length),
    create: jest.fn().mockImplementation((d: any) => d),
    save: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const configService = {
    get: jest.fn().mockReturnValue('a'.repeat(32)),
  } as unknown as ConfigService;

  const service = new MfaService(
    mfaRepository as any,
    recoveryCodeRepository as any,
    userRepository as any,
    new DataEncryptionService(configService),
  );

  return { service, userRepository, mfaRepository, recoveryCodeRepository };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('MfaService', () => {
  // ── setupMfa ──────────────────────────────────────────────────────────────
  describe('setupMfa', () => {
    it('returns a base32 secret, QR code data URL, and 10 plaintext recovery codes', async () => {
      const user = makeUser();
      const { service } = buildService(user);

      const result = await service.setupMfa(user.id);

      expect(result.secret).toMatch(/^[A-Z2-7]+=*$/); // base32
      expect(result.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(result.backupCodes).toHaveLength(10);
    });

    it('formats recovery codes as XXXXX-XXXXX-XXXXX-XXXXX (hex groups)', async () => {
      const user = makeUser();
      const { service } = buildService(user);

      const { backupCodes } = await service.setupMfa(user.id);

      for (const code of backupCodes) {
        expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}$/);
      }
    });

    it('generates unique codes across calls (crypto.randomBytes)', async () => {
      const user = makeUser();
      const { service } = buildService(user);

      const a = await service.setupMfa(user.id);
      const b = await service.setupMfa(user.id);

      const setA = new Set(a.backupCodes);
      const setB = new Set(b.backupCodes);
      const overlap = [...setA].filter((c) => setB.has(c));
      expect(overlap).toHaveLength(0);
    });

    it('throws NotFoundException when user does not exist', async () => {
      const user = makeUser();
      const { service, userRepository } = buildService(user);
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.setupMfa('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── verifyAndEnableMfa ────────────────────────────────────────────────────
  describe('verifyAndEnableMfa', () => {
    it('enables MFA and returns 10 plaintext recovery codes on valid TOTP', async () => {
      const user = makeUser();
      const { service } = buildService(user);

      const setup = await service.setupMfa(user.id);
      const validCode = speakeasy.totp({ secret: setup.secret, encoding: 'base32' });

      const result = await service.verifyAndEnableMfa(user.id, validCode);

      expect(result.success).toBe(true);
      expect(user.mfaEnabled).toBe(true);
      expect(result.backupCodes).toHaveLength(10);
    });

    it('throws BadRequestException when setup was never called', async () => {
      const user = makeUser({ mfaSecret: null });
      const { service } = buildService(user);

      await expect(service.verifyAndEnableMfa(user.id, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the persisted secret is corrupted', async () => {
      const user = makeUser({ mfaSecret: 'not-valid-ciphertext' });
      const { service } = buildService(user);

      await expect(service.verifyAndEnableMfa(user.id, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException on incorrect TOTP code', async () => {
      const user = makeUser();
      const { service } = buildService(user);
      await service.setupMfa(user.id);

      await expect(service.verifyAndEnableMfa(user.id, '000000')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('persists hashed codes (not plaintext) to the recovery code repository', async () => {
      const user = makeUser();
      const { service, recoveryCodeRepository } = buildService(user);

      const setup = await service.setupMfa(user.id);
      const validCode = speakeasy.totp({ secret: setup.secret, encoding: 'base32' });
      const result = await service.verifyAndEnableMfa(user.id, validCode);

      // save was called with objects that have codeHash, not the plaintext code
      const savedEntities: any[] = recoveryCodeRepository.save.mock.calls.flat(2);
      for (const entity of savedEntities) {
        if (entity.codeHash) {
          for (const plain of result.backupCodes!) {
            expect(entity.codeHash).not.toBe(plain);
          }
        }
      }
    });
  });

  // ── verifyBackupCodeOnly — single-use consumption ─────────────────────────
  describe('verifyBackupCodeOnly', () => {
    it('returns success=true and decrements remaining count on valid code', async () => {
      const user = makeUser();
      // Pre-generate a real hash to simulate a stored code
      const argon2 = await import('argon2');
      const plainCode = 'ABCDE-FGHIJ-KLMNO-PQRST';
      const hash = await argon2.hash(plainCode);

      const row = makeRecoveryCodeRecord({ codeHash: hash, consumedAt: null });
      const { service, recoveryCodeRepository } = buildService(user, [row]);
      recoveryCodeRepository.count.mockResolvedValue(0); // after consumption

      const result = await service.verifyBackupCodeOnly(user.id, plainCode);

      expect(result.success).toBe(true);
      expect(result.remainingCodes).toBe(0);
      // The row must have been saved with consumedAt set
      const savedRow = recoveryCodeRepository.save.mock.calls[0][0];
      expect(savedRow.consumedAt).toBeInstanceOf(Date);
    });

    it('returns success=false for an invalid code', async () => {
      const user = makeUser();
      const argon2 = await import('argon2');
      const hash = await argon2.hash('VALID-VALID-VALID-VALID');
      const row = makeRecoveryCodeRecord({ codeHash: hash, consumedAt: null });
      const { service } = buildService(user, [row]);

      const result = await service.verifyBackupCodeOnly(user.id, 'WRONG-WRONG-WRONG-WRONG');

      expect(result.success).toBe(false);
    });

    it('returns success=false when all codes are already consumed', async () => {
      const user = makeUser();
      const argon2 = await import('argon2');
      const hash = await argon2.hash('ABCDE-FGHIJ-KLMNO-PQRST');
      // consumedAt is set — simulates already-used code
      const row = makeRecoveryCodeRecord({ codeHash: hash, consumedAt: new Date() });
      const { service, recoveryCodeRepository } = buildService(user, []);
      // find returns empty (only unconsumed codes are queried)
      recoveryCodeRepository.find.mockResolvedValue([]);

      const result = await service.verifyBackupCodeOnly(user.id, 'ABCDE-FGHIJ-KLMNO-PQRST');

      expect(result.success).toBe(false);
    });

    it('does not allow the same code to be used twice', async () => {
      const user = makeUser();
      const argon2 = await import('argon2');
      const plainCode = 'ABCDE-FGHIJ-KLMNO-PQRST';
      const hash = await argon2.hash(plainCode);

      const row = makeRecoveryCodeRecord({ codeHash: hash, consumedAt: null });
      const { service, recoveryCodeRepository } = buildService(user, [row]);

      // First use — succeeds
      recoveryCodeRepository.count.mockResolvedValue(9);
      const first = await service.verifyBackupCodeOnly(user.id, plainCode);
      expect(first.success).toBe(true);

      // Second use — find returns empty (row now consumed)
      recoveryCodeRepository.find.mockResolvedValue([]);
      const second = await service.verifyBackupCodeOnly(user.id, plainCode);
      expect(second.success).toBe(false);
    });

    it('throws NotFoundException when no active MFA device exists', async () => {
      const user = makeUser();
      const { service, mfaRepository } = buildService(user);
      mfaRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyBackupCodeOnly(user.id, 'ABCDE-FGHIJ-KLMNO-PQRST')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── generateNewBackupCodes — regeneration invalidation ────────────────────
  describe('generateNewBackupCodes', () => {
    it('deletes all previous codes before inserting new ones', async () => {
      const user = makeUser();
      const { service, recoveryCodeRepository } = buildService(user);

      await service.generateNewBackupCodes(user.id);

      expect(recoveryCodeRepository.delete).toHaveBeenCalledWith({ userId: user.id });
    });

    it('returns 10 new plaintext codes', async () => {
      const user = makeUser();
      const { service } = buildService(user);

      const codes = await service.generateNewBackupCodes(user.id);

      expect(codes).toHaveLength(10);
      for (const code of codes) {
        expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}$/);
      }
    });

    it('new codes are different from any previously generated set', async () => {
      const user = makeUser();
      const { service } = buildService(user);

      const first = await service.generateNewBackupCodes(user.id);
      const second = await service.generateNewBackupCodes(user.id);

      const overlap = first.filter((c) => second.includes(c));
      expect(overlap).toHaveLength(0);
    });

    it('throws NotFoundException when MFA device does not exist', async () => {
      const user = makeUser();
      const { service, mfaRepository } = buildService(user);
      mfaRepository.findOne.mockResolvedValue(null);

      await expect(service.generateNewBackupCodes(user.id)).rejects.toThrow(NotFoundException);
    });
  });

  // ── Brute-force: exhausting all codes ─────────────────────────────────────
  describe('brute-force resistance', () => {
    it('all codes return false after being exhausted', async () => {
      const user = makeUser();
      const { service, recoveryCodeRepository } = buildService(user, []);
      // Simulate no active codes remaining
      recoveryCodeRepository.find.mockResolvedValue([]);

      const attempts = Array.from({ length: 10 }, (_, i) =>
        service.verifyBackupCodeOnly(user.id, `AAAAA-BBBBB-CCCCC-${String(i).padStart(5, '0')}`),
      );
      const results = await Promise.all(attempts);

      expect(results.every((r) => !r.success)).toBe(true);
    });

    it('invalid codes never mutate the stored rows', async () => {
      const user = makeUser();
      const argon2 = await import('argon2');
      const hash = await argon2.hash('VALID-VALID-VALID-VALID');
      const row = makeRecoveryCodeRecord({ codeHash: hash, consumedAt: null });
      const { service, recoveryCodeRepository } = buildService(user, [row]);

      await service.verifyBackupCodeOnly(user.id, 'WRONG-WRONG-WRONG-WRONG');

      // save should NOT have been called (no match → no mutation)
      expect(recoveryCodeRepository.save).not.toHaveBeenCalled();
    });
  });
});
