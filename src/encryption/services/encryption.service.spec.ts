import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';
import { KeyManagementService } from './key-management.service';
import { ValidationError } from '../errors';
import { EncryptedRecord } from '../interfaces';

describe('EncryptionService - Task 5.1 Validation', () => {
  let service: EncryptionService;
  let kms: KeyManagementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EncryptionService, KeyManagementService],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    kms = module.get<KeyManagementService>(KeyManagementService);

    // Initialize a test patient KEK
    await kms.initializePatientKek('test-patient');
  });

  describe('EncryptedRecord structure validation', () => {
    it('should throw ValidationError when EncryptedRecord is null', async () => {
      await expect(
        service.decryptRecord(null as any, 'test-patient')
      ).rejects.toThrow(ValidationError);
      
      await expect(
        service.decryptRecord(null as any, 'test-patient')
      ).rejects.toThrow('EncryptedRecord is null or undefined');
    });

    it('should throw ValidationError when EncryptedRecord is undefined', async () => {
      await expect(
        service.decryptRecord(undefined as any, 'test-patient')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when iv is missing', async () => {
      const malformedRecord = {
        ciphertext: Buffer.from('test'),
        authTag: Buffer.from('test'),
        encryptedDek: Buffer.from('test'),
        dekVersion: 'v1',
      } as any;

      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow(ValidationError);
      
      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow('iv is missing or empty');
    });

    it('should throw ValidationError when iv is empty', async () => {
      const malformedRecord = {
        iv: Buffer.alloc(0),
        ciphertext: Buffer.from('test'),
        authTag: Buffer.from('test'),
        encryptedDek: Buffer.from('test'),
        dekVersion: 'v1',
      } as EncryptedRecord;

      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow(ValidationError);
      
      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow('iv is missing or empty');
    });

    it('should throw ValidationError when ciphertext is missing', async () => {
      const malformedRecord = {
        iv: Buffer.from('test'),
        authTag: Buffer.from('test'),
        encryptedDek: Buffer.from('test'),
        dekVersion: 'v1',
      } as any;

      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow(ValidationError);
      
      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow('ciphertext is missing or empty');
    });

    it('should throw ValidationError when ciphertext is empty', async () => {
      const malformedRecord = {
        iv: Buffer.from('test'),
        ciphertext: Buffer.alloc(0),
        authTag: Buffer.from('test'),
        encryptedDek: Buffer.from('test'),
        dekVersion: 'v1',
      } as EncryptedRecord;

      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow(ValidationError);
      
      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow('ciphertext is missing or empty');
    });

    it('should throw ValidationError when authTag is missing', async () => {
      const malformedRecord = {
        iv: Buffer.from('test'),
        ciphertext: Buffer.from('test'),
        encryptedDek: Buffer.from('test'),
        dekVersion: 'v1',
      } as any;

      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow(ValidationError);
      
      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow('authTag is missing or empty');
    });

    it('should throw ValidationError when authTag is empty', async () => {
      const malformedRecord = {
        iv: Buffer.from('test'),
        ciphertext: Buffer.from('test'),
        authTag: Buffer.alloc(0),
        encryptedDek: Buffer.from('test'),
        dekVersion: 'v1',
      } as EncryptedRecord;

      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow(ValidationError);
      
      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow('authTag is missing or empty');
    });

    it('should throw ValidationError when encryptedDek is missing', async () => {
      const malformedRecord = {
        iv: Buffer.from('test'),
        ciphertext: Buffer.from('test'),
        authTag: Buffer.from('test'),
        dekVersion: 'v1',
      } as any;

      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow(ValidationError);
      
      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow('encryptedDek is missing or empty');
    });

    it('should throw ValidationError when encryptedDek is empty', async () => {
      const malformedRecord = {
        iv: Buffer.from('test'),
        ciphertext: Buffer.from('test'),
        authTag: Buffer.from('test'),
        encryptedDek: Buffer.alloc(0),
        dekVersion: 'v1',
      } as EncryptedRecord;

      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow(ValidationError);
      
      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow('encryptedDek is missing or empty');
    });

    it('should throw ValidationError when dekVersion is missing', async () => {
      const malformedRecord = {
        iv: Buffer.from('test'),
        ciphertext: Buffer.from('test'),
        authTag: Buffer.from('test'),
        encryptedDek: Buffer.from('test'),
      } as any;

      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow(ValidationError);
      
      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow('dekVersion is missing or empty');
    });

    it('should throw ValidationError when dekVersion is empty string', async () => {
      const malformedRecord = {
        iv: Buffer.from('test'),
        ciphertext: Buffer.from('test'),
        authTag: Buffer.from('test'),
        encryptedDek: Buffer.from('test'),
        dekVersion: '',
      } as EncryptedRecord;

      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow(ValidationError);
      
      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow('dekVersion is missing or empty');
    });

    it('should throw ValidationError when dekVersion is whitespace only', async () => {
      const malformedRecord = {
        iv: Buffer.from('test'),
        ciphertext: Buffer.from('test'),
        authTag: Buffer.from('test'),
        encryptedDek: Buffer.from('test'),
        dekVersion: '   ',
      } as EncryptedRecord;

      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow(ValidationError);
      
      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow('dekVersion is missing or empty');
    });

    it('should pass validation with valid EncryptedRecord structure', async () => {
      // First encrypt a record to get a valid structure
      const payload = Buffer.from('test medical record');
      const encryptedRecord = await service.encryptRecord(payload, 'test-patient');

      // This should not throw ValidationError (it will decrypt successfully)
      const decrypted = await service.decryptRecord(encryptedRecord, 'test-patient');
      expect(decrypted.equals(payload)).toBe(true);
    });
  });
});

describe('EncryptionService - Task 6.2 Encrypted DEK Error Handling', () => {
  let service: EncryptionService;
  let kms: KeyManagementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EncryptionService, KeyManagementService],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    kms = module.get<KeyManagementService>(KeyManagementService);

    // Initialize a test patient KEK
    kms.initializeTestKeks(['test-patient']);
  });

  describe('Invalid or corrupted encrypted DEK handling', () => {
    it('should throw KeyManagementError when encrypted DEK is corrupted', async () => {
      // Arrange: Create a valid encrypted record first
      const payload = Buffer.from('test medical record');
      const encryptedRecord = await service.encryptRecord(payload, 'test-patient');

      // Corrupt the encrypted DEK by flipping some bits
      const corruptedRecord = {
        ...encryptedRecord,
        encryptedDek: Buffer.from(encryptedRecord.encryptedDek),
      };
      corruptedRecord.encryptedDek[20] ^= 0xFF; // Flip bits in the middle

      // Act & Assert: Should throw KeyManagementError
      await expect(
        service.decryptRecord(corruptedRecord, 'test-patient')
      ).rejects.toThrow('Failed to unwrap DEK for patient test-patient');
    });

    it('should throw KeyManagementError when patient KEK is not found', async () => {
      // Arrange: Create a valid encrypted record
      const payload = Buffer.from('test medical record');
      const encryptedRecord = await service.encryptRecord(payload, 'test-patient');

      // Act & Assert: Try to decrypt with a different patient ID (KEK not found)
      await expect(
        service.decryptRecord(encryptedRecord, 'nonexistent-patient')
      ).rejects.toThrow('KEK not found for patient nonexistent-patient');
    });

    it('should throw KeyManagementError when encrypted DEK is too short', async () => {
      // Arrange: Create a malformed encrypted record with invalid encrypted DEK
      const payload = Buffer.from('test medical record');
      const encryptedRecord = await service.encryptRecord(payload, 'test-patient');

      // Replace encrypted DEK with a buffer that's too short (less than 28 bytes: 12 IV + 16 auth tag)
      const malformedRecord = {
        ...encryptedRecord,
        encryptedDek: Buffer.alloc(10), // Too short to be valid
      };

      // Act & Assert: Should throw KeyManagementError
      await expect(
        service.decryptRecord(malformedRecord, 'test-patient')
      ).rejects.toThrow('Failed to unwrap DEK for patient test-patient');
    });

    it('should log security event when encrypted DEK unwrapping fails', async () => {
      // Arrange: Create a valid encrypted record and corrupt it
      const payload = Buffer.from('test medical record');
      const encryptedRecord = await service.encryptRecord(payload, 'test-patient');

      const corruptedRecord = {
        ...encryptedRecord,
        encryptedDek: Buffer.from(encryptedRecord.encryptedDek),
      };
      corruptedRecord.encryptedDek[20] ^= 0xFF;

      // Spy on the logger
      const loggerSpy = jest.spyOn((service as any).logger, 'warn');

      // Act: Try to decrypt with corrupted encrypted DEK
      try {
        await service.decryptRecord(corruptedRecord, 'test-patient');
      } catch (error) {
        // Expected to throw
      }

      // Assert: Verify logging occurred
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to unwrap DEK for patient test-patient')
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Encrypted DEK may be invalid or corrupted')
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('encryptedDek_length=')
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('dekVersion=')
      );

      // Verify no sensitive data is logged
      const loggedMessage = loggerSpy.mock.calls[0][0];
      expect(loggedMessage).not.toContain('DEK');
      expect(loggedMessage).not.toContain('plaintext');
      expect(loggedMessage).not.toContain('key');
    });
  });
});
