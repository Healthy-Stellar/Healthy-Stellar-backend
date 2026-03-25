import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { AwsKmsService } from '../services/aws-kms.service';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { TenantService } from '../../tenant/services/tenant.service';
import { KeyManagementException, KeyNotFoundException } from '../exceptions/key-management.exceptions';
import { BrokenCircuitError } from 'cockatiel';

// Mock AWS SDK
jest.mock('@aws-sdk/client-kms');

describe('AwsKmsService', () => {
  let service: AwsKmsService;
  let configService: jest.Mocked<ConfigService>;
  let circuitBreaker: jest.Mocked<CircuitBreakerService>;
  let auditLog: jest.Mocked<AuditLogService>;
  let tenantService: jest.Mocked<TenantService>;
  let mockKmsClient: jest.Mocked<KMSClient>;

  const mockTenant = {
    id: 'tenant-1',
    kmsCmkArn: 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012',
  };

  beforeEach(async () => {
    const mockKmsClientInstance = {
      send: jest.fn(),
    };
    (KMSClient as jest.Mock).mockImplementation(() => mockKmsClientInstance);
    mockKmsClient = mockKmsClientInstance as jest.Mocked<KMSClient>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AwsKmsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: CircuitBreakerService,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: TenantService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AwsKmsService>(AwsKmsService);
    configService = module.get(ConfigService);
    circuitBreaker = module.get(CircuitBreakerService);
    auditLog = module.get(AuditLogService);
    tenantService = module.get(TenantService);
  });

  describe('KMS Enabled Mode', () => {
    beforeEach(() => {
      configService.get.mockImplementation((key: string, defaultValue?: string) => {
        switch (key) {
          case 'KMS_ENABLED': return 'true';
          case 'AWS_REGION': return 'us-east-1';
          case 'AWS_ACCESS_KEY_ID': return 'test-access-key';
          case 'AWS_SECRET_ACCESS_KEY': return 'test-secret-key';
          default: return defaultValue;
        }
      });
      tenantService.findById.mockResolvedValue(mockTenant as any);
    });

    describe('generateDataKey', () => {
      it('should generate data key successfully', async () => {
        const mockResult = {
          CiphertextBlob: new Uint8Array([1, 2, 3, 4]),
          Plaintext: new Uint8Array([5, 6, 7, 8]),
        };

        circuitBreaker.execute.mockImplementation(async (_, fn) => fn());
        mockKmsClient.send.mockResolvedValue(mockResult);

        const result = await service.generateDataKey('patient-123');

        expect(result.encryptedKey).toEqual(Buffer.from([1, 2, 3, 4]));
        expect(result.plainKey).toEqual(Buffer.from([5, 6, 7, 8]));
        expect(auditLog.create).toHaveBeenCalledWith({
          operation: 'GENERATE_DATA_KEY',
          entityType: 'PATIENT_KEY',
          entityId: 'patient-123',
          userId: 'system',
          status: 'SUCCESS',
        });
      });

      it('should handle circuit breaker failure', async () => {
        circuitBreaker.execute.mockRejectedValue(new BrokenCircuitError('Circuit open'));

        await expect(service.generateDataKey('patient-123'))
          .rejects.toThrow(KeyManagementException);
      });

      it('should handle missing CMK', async () => {
        tenantService.findById.mockResolvedValue({ id: 'tenant-1' } as any);

        await expect(service.generateDataKey('patient-123'))
          .rejects.toThrow(KeyNotFoundException);
      });
    });

    describe('decryptDataKey', () => {
      it('should decrypt data key successfully', async () => {
        const encryptedKey = Buffer.from([1, 2, 3, 4]);
        const mockResult = {
          Plaintext: new Uint8Array([5, 6, 7, 8]),
        };

        circuitBreaker.execute.mockImplementation(async (_, fn) => fn());
        mockKmsClient.send.mockResolvedValue(mockResult);

        const result = await service.decryptDataKey(encryptedKey, 'patient-123');

        expect(result).toEqual(Buffer.from([5, 6, 7, 8]));
        expect(mockKmsClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              CiphertextBlob: encryptedKey,
              EncryptionContext: {
                patientId: 'patient-123',
                tenantId: 'default-tenant',
              },
            }),
          })
        );
      });
    });
  });

  describe('Local Development Mode', () => {
    beforeEach(() => {
      configService.get.mockImplementation((key: string, defaultValue?: string) => {
        switch (key) {
          case 'KMS_ENABLED': return 'false';
          case 'LOCAL_KEK': return 'test-key-encryption-key-32-chars';
          default: return defaultValue;
        }
      });
    });

    describe('generateDataKey', () => {
      it('should generate local data key', async () => {
        const result = await service.generateDataKey('patient-123');

        expect(result.encryptedKey).toBeInstanceOf(Buffer);
        expect(result.plainKey).toBeInstanceOf(Buffer);
        expect(result.plainKey).toHaveLength(32); // AES-256 key
        expect(auditLog.create).toHaveBeenCalled();
      });
    });

    describe('decryptDataKey', () => {
      it('should decrypt local data key', async () => {
        // First generate a key to get encrypted data
        const generated = await service.generateDataKey('patient-123');
        
        // Then decrypt it
        const decrypted = await service.decryptDataKey(generated.encryptedKey, 'patient-123');

        expect(decrypted).toEqual(generated.plainKey);
      });
    });
  });

  describe('rotatePatientKey', () => {
    it('should log key rotation', async () => {
      await service.rotatePatientKey('patient-123');

      expect(auditLog.create).toHaveBeenCalledWith({
        operation: 'ROTATE_PATIENT_KEY',
        entityType: 'PATIENT_KEY',
        entityId: 'patient-123',
        userId: 'system',
        status: 'SUCCESS',
      });
    });
  });

  describe('destroyPatientKeys', () => {
    it('should log key destruction', async () => {
      await service.destroyPatientKeys('patient-123');

      expect(auditLog.create).toHaveBeenCalledWith({
        operation: 'DESTROY_PATIENT_KEYS',
        entityType: 'PATIENT_KEY',
        entityId: 'patient-123',
        userId: 'system',
        status: 'SUCCESS',
        changes: { gdprErasure: true },
      });
    });
  });
});