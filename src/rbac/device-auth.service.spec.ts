import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { DeviceAuthService } from '../device-auth.service';
import {
  MedicalDevice,
  DeviceType,
  DeviceStatus,
  DeviceTrustLevel,
} from '../../entities/medical-device.entity';
import { EncryptionService } from '../../encryption/encryption.service';
import { AuditService } from '../../audit/audit.service';

const makeDevice = (overrides: Partial<MedicalDevice> = {}): MedicalDevice => ({
  id: 'device-uuid-1',
  name: 'Patient Monitor A',
  type: DeviceType.PATIENT_MONITOR,
  deviceSerialNumber: 'SN-001',
  manufacturer: 'MedTech Corp',
  model: 'PM-500',
  firmwareVersion: '2.1.0',
  status: DeviceStatus.ACTIVE,
  trustLevel: DeviceTrustLevel.MEDIUM,
  certificateFingerprint: null,
  publicKey: null,
  apiKeyHash: 'hashed:test-api-key',
  location: 'ICU Room 1',
  department: 'ICU',
  lastKnownIpAddress: null,
  lastSeenAt: null,
  certExpiresAt: null,
  allowedCapabilities: null,
  allowedIpRanges: null,
  failedAuthAttempts: 0,
  suspendedUntil: null,
  registeredBy: 'admin',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('DeviceAuthService', () => {
  let service: DeviceAuthService;
  let deviceRepo: any;
  let encryptionService: jest.Mocked<EncryptionService>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceAuthService,
        {
          provide: getRepositoryToken(MedicalDevice),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findOneOrFail: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: EncryptionService,
          useValue: {
            generateSecureToken: jest.fn(() => 'secure-token-64-chars-hex'),
            hashIdentifier: jest.fn((val: string) => `hashed:${val}`),
            createIntegritySignature: jest.fn(() => 'sig'),
          },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<DeviceAuthService>(DeviceAuthService);
    deviceRepo = module.get(getRepositoryToken(MedicalDevice));
    encryptionService = module.get(EncryptionService);
    auditService = module.get(AuditService);

    jest.clearAllMocks();
  });

  describe('registerDevice', () => {
    it('should register a device and return the raw API key once', async () => {
      const device = makeDevice({ status: DeviceStatus.INACTIVE, trustLevel: DeviceTrustLevel.LOW });
      deviceRepo.create.mockReturnValue(device);
      deviceRepo.save.mockResolvedValue(device);

      const result = await service.registerDevice({
        name: 'ICU Monitor',
        type: DeviceType.PATIENT_MONITOR,
        deviceSerialNumber: 'SN-001',
        registeredBy: 'admin',
      });

      expect(deviceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: DeviceStatus.INACTIVE,
          trustLevel: DeviceTrustLevel.LOW,
        }),
      );
      // The returned apiKeyHash should be the raw token (not the hash)
      expect(result.apiKeyHash).toBe('secure-token-64-chars-hex');
      expect(auditService.log).toHaveBeenCalled();
    });
  });

  describe('authenticateByApiKey', () => {
    it('should authenticate valid device', async () => {
      const device = makeDevice({ apiKeyHash: 'hashed:test-api-key' });
      deviceRepo.findOne.mockResolvedValue(device);
      deviceRepo.update.mockResolvedValue({});

      const result = await service.authenticateByApiKey('device-uuid-1', 'test-api-key', '10.0.0.1');

      expect(result.authenticated).toBe(true);
      expect(result.sessionToken).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw for invalid API key', async () => {
      const device = makeDevice({ apiKeyHash: 'hashed:correct-key' });
      deviceRepo.findOne.mockResolvedValue(device);
      deviceRepo.update.mockResolvedValue({});

      await expect(
        service.authenticateByApiKey('device-uuid-1', 'wrong-key', '10.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if device not found', async () => {
      deviceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.authenticateByApiKey('bad-id', 'any-key', '10.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for decommissioned device', async () => {
      deviceRepo.findOne.mockResolvedValue(makeDevice({ status: DeviceStatus.DECOMMISSIONED }));

      await expect(
        service.authenticateByApiKey('device-uuid-1', 'test-api-key', '10.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw for suspended device within suspension period', async () => {
      const future = new Date(Date.now() + 1000 * 60 * 60);
      deviceRepo.findOne.mockResolvedValue(
        makeDevice({ status: DeviceStatus.SUSPENDED, suspendedUntil: future }),
      );

      await expect(
        service.authenticateByApiKey('device-uuid-1', 'test-api-key', '10.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should auto-unsuspend device after suspension period', async () => {
      const past = new Date(Date.now() - 1000);
      deviceRepo.findOne.mockResolvedValue(
        makeDevice({ status: DeviceStatus.SUSPENDED, suspendedUntil: past, apiKeyHash: 'hashed:test-api-key' }),
      );
      deviceRepo.update.mockResolvedValue({});

      // After unsuspension, authentication should proceed (but apiKey still needs to match)
      await service.authenticateByApiKey('device-uuid-1', 'test-api-key', '10.0.0.1');

      expect(deviceRepo.update).toHaveBeenCalledWith(
        'device-uuid-1',
        expect.objectContaining({ status: DeviceStatus.ACTIVE }),
      );
    });

    it('should throw for expired certificate', async () => {
      const past = new Date(Date.now() - 1000);
      deviceRepo.findOne.mockResolvedValue(makeDevice({ certExpiresAt: past }));

      await expect(
        service.authenticateByApiKey('device-uuid-1', 'test-api-key', '10.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should suspend device after MAX_FAILED_ATTEMPTS', async () => {
      const device = makeDevice({
        apiKeyHash: 'hashed:correct-key',
        failedAuthAttempts: 4, // One away from max
      });
      deviceRepo.findOne.mockResolvedValue(device);
      deviceRepo.update.mockResolvedValue({});

      await expect(
        service.authenticateByApiKey('device-uuid-1', 'wrong-key', '10.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);

      expect(deviceRepo.update).toHaveBeenCalledWith(
        'device-uuid-1',
        expect.objectContaining({ status: DeviceStatus.SUSPENDED }),
      );
    });
  });

  describe('generateChallenge', () => {
    it('should generate a challenge with expiry', async () => {
      deviceRepo.findOneOrFail.mockResolvedValue(makeDevice());

      const result = await service.generateChallenge('device-uuid-1');

      expect(result.challenge).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(result.deviceId).toBe('device-uuid-1');
    });
  });

  describe('verifyChallenge', () => {
    it('should throw when no challenge exists', async () => {
      deviceRepo.findOneOrFail.mockResolvedValue(makeDevice());

      await expect(
        service.verifyChallenge('device-uuid-1', 'any-sig', '10.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when device has no public key', async () => {
      deviceRepo.findOneOrFail.mockResolvedValue(makeDevice({ publicKey: null }));
      // Manually inject a challenge
      (service as any).challengeStore.set('device-uuid-1', {
        challenge: 'test-challenge',
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(
        service.verifyChallenge('device-uuid-1', 'any-sig', '10.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should verify valid signed challenge', async () => {
      // Generate a real keypair for testing
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

      const challenge = 'test-challenge-value';
      deviceRepo.findOneOrFail.mockResolvedValue(makeDevice({ publicKey: publicKeyPem }));
      deviceRepo.update.mockResolvedValue({});

      // Manually inject challenge
      (service as any).challengeStore.set('device-uuid-1', {
        challenge,
        expiresAt: new Date(Date.now() + 60000),
      });

      // Sign the challenge
      const sign = crypto.createSign('SHA256');
      sign.update(challenge);
      const signature = sign.sign(privateKey, 'base64');

      const result = await service.verifyChallenge('device-uuid-1', signature, '10.0.0.1');

      expect(result.authenticated).toBe(true);
    });

    it('should throw for invalid signature', async () => {
      const { publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

      deviceRepo.findOneOrFail.mockResolvedValue(makeDevice({ publicKey: publicKeyPem }));
      deviceRepo.update.mockResolvedValue({});
      (service as any).challengeStore.set('device-uuid-1', {
        challenge: 'test-challenge',
        expiresAt: new Date(Date.now() + 60000),
      });

      await expect(
        service.verifyChallenge('device-uuid-1', 'invalid-base64-signature==', '10.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('revokeDevice', () => {
    it('should suspend the device and log audit event', async () => {
      deviceRepo.update.mockResolvedValue({});

      await service.revokeDevice('device-uuid-1', 'admin', 'Security incident');

      expect(deviceRepo.update).toHaveBeenCalledWith(
        'device-uuid-1',
        expect.objectContaining({ status: DeviceStatus.SUSPENDED }),
      );
      expect(auditService.log).toHaveBeenCalled();
    });
  });

  describe('updateTrustLevel', () => {
    it('should update trust level and activate device for HIGH trust', async () => {
      const device = makeDevice();
      deviceRepo.findOneOrFail.mockResolvedValue(device);
      deviceRepo.save.mockResolvedValue({ ...device, trustLevel: DeviceTrustLevel.HIGH });

      const result = await service.updateTrustLevel('device-uuid-1', DeviceTrustLevel.HIGH, 'admin');

      expect(deviceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          trustLevel: DeviceTrustLevel.HIGH,
          status: DeviceStatus.ACTIVE,
        }),
      );
    });
  });
});
