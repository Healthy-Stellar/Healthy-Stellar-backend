import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService, EncryptionContext } from '../encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        ENCRYPTION_MASTER_KEY: 'test-master-key-that-is-at-least-32-chars!!',
        ENCRYPTION_SALT: 'test-salt-hipaa-2024',
        HASH_SALT: 'test-hash-salt',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EncryptionService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  describe('encrypt / decrypt', () => {
    it('should encrypt and decrypt a string successfully', () => {
      const plaintext = 'Sensitive patient data: John Doe, DOB 1990-01-01';
      const encrypted = service.encrypt(plaintext);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      expect(encrypted.keyVersion).toBe('1');
      expect(encrypted.ciphertext).not.toBe(plaintext);

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (unique IVs)', () => {
      const plaintext = 'Same data encrypted twice';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should encrypt/decrypt with context for PHI', () => {
      const context: EncryptionContext = {
        dataType: 'PHI',
        userId: 'user-123',
        patientId: 'patient-456',
      };
      const plaintext = 'PHI: Patient blood type A+';
      const encrypted = service.encrypt(plaintext, context);
      const decrypted = service.decrypt(encrypted, context);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail to decrypt with wrong context', () => {
      const context: EncryptionContext = { dataType: 'PHI' };
      const wrongContext: EncryptionContext = { dataType: 'PII' };

      const plaintext = 'Sensitive data';
      const encrypted = service.encrypt(plaintext, context);

      expect(() => service.decrypt(encrypted, wrongContext)).toThrow();
    });

    it('should reject decryption with tampered ciphertext', () => {
      const encrypted = service.encrypt('test data');
      encrypted.ciphertext = encrypted.ciphertext.replace('A', 'B');

      expect(() => service.decrypt(encrypted)).toThrow();
    });

    it('should reject decryption with tampered auth tag', () => {
      const encrypted = service.encrypt('test data');
      encrypted.authTag = Buffer.alloc(16).toString('base64');

      expect(() => service.decrypt(encrypted)).toThrow();
    });

    it('should throw on unsupported key version', () => {
      const encrypted = service.encrypt('test');
      encrypted.keyVersion = '99';

      expect(() => service.decrypt(encrypted)).toThrow('Unsupported key version: 99');
    });
  });

  describe('hashIdentifier', () => {
    it('should produce consistent hashes', () => {
      const hash1 = service.hashIdentifier('patient-123');
      const hash2 = service.hashIdentifier('patient-123');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = service.hashIdentifier('patient-123');
      const hash2 = service.hashIdentifier('patient-456');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes with different salts', () => {
      const hash1 = service.hashIdentifier('patient-123', 'salt1');
      const hash2 = service.hashIdentifier('patient-123', 'salt2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate a hex token of correct length', () => {
      const token = service.generateSecureToken(32);
      expect(token).toHaveLength(64); // hex = 2 chars per byte
    });

    it('should generate unique tokens', () => {
      const tokens = new Set(Array.from({ length: 100 }, () => service.generateSecureToken()));
      expect(tokens.size).toBe(100);
    });
  });

  describe('encryptObject / decryptObject', () => {
    it('should encrypt specified fields in an object', () => {
      const patient = {
        id: 'patient-123',
        name: 'John Doe',
        ssn: '123-45-6789',
        dateOfBirth: '1990-01-01',
        publicNotes: 'Non-sensitive note',
      };

      const encrypted = service.encryptObject(patient, ['ssn', 'dateOfBirth']);

      expect(encrypted._encrypted).toEqual(['ssn', 'dateOfBirth']);
      expect(encrypted.id).toBe(patient.id);
      expect(encrypted.name).toBe(patient.name);
      expect(encrypted.publicNotes).toBe(patient.publicNotes);
      expect(typeof encrypted.ssn).toBe('object'); // encrypted data object
      expect(typeof encrypted.dateOfBirth).toBe('object');
    });

    it('should decrypt object fields back to original values', () => {
      const original = { id: '1', ssn: '123-45-6789', name: 'Jane Doe' };
      const encrypted = service.encryptObject(original, ['ssn']);
      const decrypted = service.decryptObject(encrypted);

      expect(decrypted.ssn).toBe(original.ssn);
      expect(decrypted.id).toBe(original.id);
      expect(decrypted.name).toBe(original.name);
      expect((decrypted as Record<string, unknown>)._encrypted).toBeUndefined();
    });
  });

  describe('createIntegritySignature / verifyIntegritySignature', () => {
    it('should create and verify a valid signature', () => {
      const data = 'Audit log entry data';
      const signature = service.createIntegritySignature(data);
      expect(service.verifyIntegritySignature(data, signature)).toBe(true);
    });

    it('should reject tampered data', () => {
      const data = 'Audit log entry data';
      const signature = service.createIntegritySignature(data);
      expect(service.verifyIntegritySignature('Tampered data', signature)).toBe(false);
    });

    it('should reject tampered signature', () => {
      const data = 'Audit log entry data';
      const signature = service.createIntegritySignature(data);
      const tampered = signature.replace('a', 'b');
      expect(service.verifyIntegritySignature(data, tampered)).toBe(false);
    });
  });

  describe('generateDataKey', () => {
    it('should generate a plaintext and encrypted key pair', () => {
      const { plaintext, encrypted } = service.generateDataKey();
      expect(plaintext).toBeInstanceOf(Buffer);
      expect(plaintext).toHaveLength(32);
      expect(typeof encrypted).toBe('string');
      const parsed = JSON.parse(encrypted);
      expect(parsed.ciphertext).toBeDefined();
      expect(parsed.iv).toBeDefined();
    });
  });

  describe('initialization', () => {
    it('should throw if master key is too short', () => {
      const badConfig = {
        get: jest.fn((key: string) => (key === 'ENCRYPTION_MASTER_KEY' ? 'short' : undefined)),
      };

      expect(() => {
        new EncryptionService(badConfig as unknown as ConfigService);
      }).toThrow('ENCRYPTION_MASTER_KEY must be at least 32 characters');
    });

    it('should throw if master key is missing', () => {
      const badConfig = {
        get: jest.fn(() => undefined),
      };

      expect(() => {
        new EncryptionService(badConfig as unknown as ConfigService);
      }).toThrow();
    });
  });
});
