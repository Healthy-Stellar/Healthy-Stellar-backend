import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import { MfaService } from './mfa.service';
import { DataEncryptionService } from '../../common/services/data-encryption.service';

describe('MfaService', () => {
  let service: MfaService;
  let userRepository: { findOne: jest.Mock; save: jest.Mock };
  let mfaRepository: { create: jest.Mock; save: jest.Mock };

  const user = {
    id: 'user-1',
    email: 'patient@example.com',
    mfaSecret: null as string | null,
    mfaEnabled: false,
  };

  beforeEach(() => {
    user.mfaSecret = null;
    user.mfaEnabled = false;

    userRepository = {
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn().mockImplementation(async (u) => {
        Object.assign(user, u);
        return user;
      }),
    };
    mfaRepository = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const configService = {
      get: jest.fn().mockReturnValue('a'.repeat(32)),
    } as unknown as ConfigService;

    service = new MfaService(
      mfaRepository as any,
      userRepository as any,
      new DataEncryptionService(configService),
    );
  });

  it('verifies enrollment against the exact secret returned by setupMfa (Issue #793)', async () => {
    const setup = await service.setupMfa(user.id);

    // The persisted secret must round-trip to the one shown for QR scanning.
    const validCode = speakeasy.totp({ secret: setup.secret, encoding: 'base32' });

    const result = await service.verifyAndEnableMfa(user.id, validCode);

    expect(result.success).toBe(true);
    expect(user.mfaEnabled).toBe(true);
  });

  it('rejects verification when setup was never called', async () => {
    await expect(service.verifyAndEnableMfa(user.id, '123456')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects verification when the persisted secret is corrupted', async () => {
    user.mfaSecret = 'not-valid-ciphertext';

    await expect(service.verifyAndEnableMfa(user.id, '123456')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an incorrect verification code', async () => {
    await service.setupMfa(user.id);

    await expect(service.verifyAndEnableMfa(user.id, '000000')).rejects.toThrow(
      BadRequestException,
    );
  });
});
