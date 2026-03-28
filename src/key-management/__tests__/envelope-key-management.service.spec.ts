import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { EnvelopeKeyManagementService } from '../services/envelope-key-management.service';
import { PatientDekEntity } from '../entities/patient-dek.entity';
import { EncryptedKey } from '../interfaces/key-management.interface';
import { KeyManagementException, KeyRotationException } from '../exceptions/key-management.exceptions';

const MASTER_KEY_HEX = randomBytes(32).toString('hex');
const MASTER_KEY_VERSION = 'v1';

function buildModule(configOverrides: Record<string, string> = {}) {
  const config: Record<string, string> = {
    MASTER_KEY: MASTER_KEY_HEX,
    MASTER_KEY_VERSION,
    ...configOverrides,
  };

  const savedDeks = new Map<string, PatientDekEntity>();

  const mockRepo = {
    find: jest.fn().mockResolvedValue([...savedDeks.values()]),
    save: jest.fn().mockImplementation(async (data: Partial<PatientDekEntity>) => {
      const entity = { ...data } as PatientDekEntity;
      savedDeks.set(entity.patientAddress, entity);
      return entity;
    }),
    _savedDeks: savedDeks,
  };

  return { config, mockRepo };
}

async function createService(
  configOverrides: Record<string, string> = {},
): Promise<{ service: EnvelopeKeyManagementService; mockRepo: ReturnType<typeof buildModule>['mockRepo'] }> {
  const { config, mockRepo } = buildModule(configOverrides);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      EnvelopeKeyManagementService,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string, def?: string) => config[key] ?? def),
        },
      },
      {
        provide: getRepositoryToken(PatientDekEntity),
        useValue: mockRepo,
      },
    ],
  }).compile();

  const service = module.get<EnvelopeKeyManagementService>(EnvelopeKeyManagementService);
  service.onModuleInit();
  return { service, mockRepo };
}

describe('EnvelopeKeyManagementService', () => {
  describe('generateDEK', () => {
    it('returns a 32-byte plainKey and a structured EncryptedKey', async () => {
      const { service } = await createService();
      const result = await service.generateDEK('GPATIENT1');

      expect(result.plainKey).toBeInstanceOf(Buffer);
      expect(result.plainKey.length).toBe(32);
      expect(result.encryptedKey.ciphertext).toBeInstanceOf(Buffer);
      expect(result.encryptedKey.iv.length).toBe(12);
      expect(result.encryptedKey.authTag.length).toBe(16);
      expect(result.encryptedKey.masterKeyVersion).toBe(MASTER_KEY_VERSION);
    });

    it('persists the encrypted DEK to the repository', async () => {
      const { service, mockRepo } = await createService();
      await service.generateDEK('GPATIENT2');

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ patientAddress: 'GPATIENT2' }),
      );
    });

    it('generates unique IVs for each call', async () => {
      const { service } = await createService();
      const r1 = await service.generateDEK('GPATIENT3');
      const r2 = await service.generateDEK('GPATIENT3');

      expect(r1.encryptedKey.iv.equals(r2.encryptedKey.iv)).toBe(false);
    });

    it('never stores the plainKey (only ciphertext is persisted)', async () => {
      const { service, mockRepo } = await createService();
      const { plainKey } = await service.generateDEK('GPATIENT4');

      const saved = mockRepo.save.mock.calls[0][0] as PatientDekEntity;
      expect(saved).not.toHaveProperty('plainKey');
      expect(Object.values(saved)).not.toContain(plainKey.toString('hex'));
    });
  });

  describe('decryptDEK', () => {
    it('round-trips: decryptDEK(generateDEK.encryptedKey) === plainKey', async () => {
      const { service } = await createService();
      const { plainKey, encryptedKey } = await service.generateDEK('GPATIENT5');
      const decrypted = await service.decryptDEK(encryptedKey);

      expect(decrypted.equals(plainKey)).toBe(true);
    });

    it('throws KeyManagementException when auth tag is tampered', async () => {
      const { service } = await createService();
      const { encryptedKey } = await service.generateDEK('GPATIENT6');

      const tampered: EncryptedKey = {
        ...encryptedKey,
        authTag: randomBytes(16),
      };

      await expect(service.decryptDEK(tampered)).rejects.toThrow(KeyManagementException);
    });

    it('throws KeyManagementException when ciphertext is corrupted', async () => {
      const { service } = await createService();
      const { encryptedKey } = await service.generateDEK('GPATIENT7');

      const corrupted: EncryptedKey = {
        ...encryptedKey,
        ciphertext: randomBytes(encryptedKey.ciphertext.length),
      };

      await expect(service.decryptDEK(corrupted)).rejects.toThrow(KeyManagementException);
    });

    it('throws KeyManagementException for unknown master key version', async () => {
      const { service } = await createService();
      const { encryptedKey } = await service.generateDEK('GPATIENT8');

      const unknownVersion: EncryptedKey = { ...encryptedKey, masterKeyVersion: 'v99' };

      await expect(service.decryptDEK(unknownVersion)).rejects.toThrow(KeyManagementException);
    });
  });

  describe('rotateMasterKey', () => {
    it('re-encrypts all DEKs with the new master key', async () => {
      const newKeyHex = randomBytes(32).toString('hex');
      const { service, mockRepo } = await createService();

      // Generate two DEKs
      const r1 = await service.generateDEK('GPATIENT9');
      const r2 = await service.generateDEK('GPATIENT10');

      // Seed the mock repo's find() with the saved rows
      mockRepo.find.mockResolvedValue([...mockRepo._savedDeks.values()]);

      // Patch config to expose new key
      (service as any).config.get = jest.fn((key: string, def?: string) => {
        const extra: Record<string, string> = {
          MASTER_KEY_NEW: newKeyHex,
          MASTER_KEY_NEW_VERSION: 'v2',
          MASTER_KEY: MASTER_KEY_HEX,
          MASTER_KEY_VERSION,
        };
        return extra[key] ?? def;
      });

      await service.rotateMasterKey();

      // After rotation the active version should be v2
      expect((service as any).masterKeyVersion).toBe('v2');

      // The re-encrypted DEKs should still decrypt to the original plain keys
      const savedRows = [...mockRepo._savedDeks.values()];
      for (const row of savedRows) {
        const encryptedKey: EncryptedKey = {
          ciphertext: Buffer.from(row.ciphertext, 'hex'),
          iv: Buffer.from(row.iv, 'hex'),
          authTag: Buffer.from(row.authTag, 'hex'),
          masterKeyVersion: row.masterKeyVersion,
        };
        const decrypted = await service.decryptDEK(encryptedKey);
        const original = row.patientAddress === 'GPATIENT9' ? r1.plainKey : r2.plainKey;
        expect(decrypted.equals(original)).toBe(true);
      }
    });

    it('throws KeyRotationException when MASTER_KEY_NEW is not set', async () => {
      const { service } = await createService();
      await expect(service.rotateMasterKey()).rejects.toThrow(KeyRotationException);
    });

    it('throws KeyRotationException when new key is wrong length', async () => {
      const { service } = await createService({
        MASTER_KEY_NEW: 'tooshort',
        MASTER_KEY_NEW_VERSION: 'v2',
      });
      await expect(service.rotateMasterKey()).rejects.toThrow(KeyRotationException);
    });
  });

  describe('security invariants', () => {
    it('onModuleInit throws when MASTER_KEY is missing', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EnvelopeKeyManagementService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
          {
            provide: getRepositoryToken(PatientDekEntity),
            useValue: { find: jest.fn(), save: jest.fn() },
          },
        ],
      }).compile();

      const svc = module.get<EnvelopeKeyManagementService>(EnvelopeKeyManagementService);
      expect(() => svc.onModuleInit()).toThrow(KeyManagementException);
    });

    it('onModuleInit throws when MASTER_KEY is wrong length', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EnvelopeKeyManagementService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn((k: string) => k === 'MASTER_KEY' ? 'deadbeef' : undefined) },
          },
          {
            provide: getRepositoryToken(PatientDekEntity),
            useValue: { find: jest.fn(), save: jest.fn() },
          },
        ],
      }).compile();

      const svc = module.get<EnvelopeKeyManagementService>(EnvelopeKeyManagementService);
      expect(() => svc.onModuleInit()).toThrow(KeyManagementException);
    });
  });
});
