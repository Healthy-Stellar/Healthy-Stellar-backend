import { Test, TestingModule } from '@nestjs/testing';
import { KeyManagementService } from './key-management.service';
import { KeyManagementError } from '../errors';
import * as crypto from 'crypto';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';

describe('KeyManagementService', () => {
  let service: KeyManagementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeyManagementService,
        {
          provide: CircuitBreakerService,
          useValue: {
            execute: jest.fn().mockImplementation((service, fn) => fn()),
          },
        },
      ],
    }).compile();

    service = module.get<KeyManagementService>(KeyManagementService);
  });

  describe('wrapDek', () => {
    it('should wrap a DEK with patient KEK', async () => {
      // Arrange
      const patientId = 'patient-123';
      const dek = crypto.randomBytes(32); // 256-bit DEK

      // Initialize KEK for the patient
      service.initializeTestKeks([patientId]);

      // Act
      const wrappedDek = await service.wrapDek(dek, patientId);

      // Assert
      expect(wrappedDek).toBeInstanceOf(Buffer);
      // Wrapped DEK should contain: IV (12 bytes) + encrypted DEK (32 bytes) + auth tag (16 bytes) = 60 bytes
      expect(wrappedDek.length).toBe(60);
    });

    it('should generate unique IVs for each wrap operation', async () => {
      // Arrange
      const patientId = 'patient-123';
      const dek = crypto.randomBytes(32);
      service.initializeTestKeks([patientId]);

      // Act - wrap the same DEK multiple times
      const wrapped1 = await service.wrapDek(dek, patientId);
      const wrapped2 = await service.wrapDek(dek, patientId);
      const wrapped3 = await service.wrapDek(dek, patientId);

      // Extract IVs (first 12 bytes)
      const iv1 = wrapped1.subarray(0, 12);
      const iv2 = wrapped2.subarray(0, 12);
      const iv3 = wrapped3.subarray(0, 12);

      // Assert - all IVs should be unique
      expect(iv1.equals(iv2)).toBe(false);
      expect(iv1.equals(iv3)).toBe(false);
      expect(iv2.equals(iv3)).toBe(false);
    });

    it('should throw KeyManagementError if KEK not found', async () => {
      // Arrange
      const patientId = 'nonexistent-patient';
      const dek = crypto.randomBytes(32);

      // Act & Assert
      await expect(service.wrapDek(dek, patientId)).rejects.toThrow(
        KeyManagementError
      );
      await expect(service.wrapDek(dek, patientId)).rejects.toThrow(
        `KEK not found for patient ${patientId}`
      );
    });

    it('should accept plaintext DEK Buffer and patientId string as parameters', async () => {
      // Arrange
      const patientId = 'patient-456';
      const dek = Buffer.from('a'.repeat(32)); // 32-byte buffer
      service.initializeTestKeks([patientId]);

      // Act
      const wrappedDek = await service.wrapDek(dek, patientId);

      // Assert
      expect(wrappedDek).toBeInstanceOf(Buffer);
      expect(typeof patientId).toBe('string');
    });

    it('should encrypt DEK using AES-256-GCM', async () => {
      // Arrange
      const patientId = 'patient-789';
      const dek = crypto.randomBytes(32);
      service.initializeTestKeks([patientId]);

      // Act
      const wrappedDek = await service.wrapDek(dek, patientId);

      // Assert - verify structure
      // IV: 12 bytes, encrypted DEK: 32 bytes, auth tag: 16 bytes
      expect(wrappedDek.length).toBe(60);

      // Verify we can unwrap it (round-trip test)
      const unwrappedDek = await service.unwrapDek(wrappedDek, patientId);
      expect(unwrappedDek.equals(dek)).toBe(true);
    });
  });

  describe('unwrapDek', () => {
    it('should accept encrypted DEK Buffer and patientId string as parameters', async () => {
      // Arrange
      const patientId = 'patient-unwrap-1';
      const dek = crypto.randomBytes(32);
      service.initializeTestKeks([patientId]);
      const wrappedDek = await service.wrapDek(dek, patientId);

      // Act
      const unwrappedDek = await service.unwrapDek(wrappedDek, patientId);

      // Assert
      expect(unwrappedDek).toBeInstanceOf(Buffer);
      expect(typeof patientId).toBe('string');
    });

    it('should retrieve patient KEK from storage', async () => {
      // Arrange
      const patientId = 'patient-unwrap-2';
      const dek = crypto.randomBytes(32);
      service.initializeTestKeks([patientId]);
      const wrappedDek = await service.wrapDek(dek, patientId);

      // Act & Assert - should succeed because KEK exists
      const unwrappedDek = await service.unwrapDek(wrappedDek, patientId);
      expect(unwrappedDek).toBeInstanceOf(Buffer);
    });

    it('should extract IV, encrypted DEK, and auth tag from input Buffer', async () => {
      // Arrange
      const patientId = 'patient-unwrap-3';
      const dek = crypto.randomBytes(32);
      service.initializeTestKeks([patientId]);
      const wrappedDek = await service.wrapDek(dek, patientId);

      // Verify the wrapped DEK has the correct structure
      expect(wrappedDek.length).toBe(60); // 12 (IV) + 32 (encrypted DEK) + 16 (auth tag)

      // Act
      const unwrappedDek = await service.unwrapDek(wrappedDek, patientId);

      // Assert - successful unwrap means components were extracted correctly
      expect(unwrappedDek.equals(dek)).toBe(true);
    });

    it('should decrypt DEK using AES-256-GCM with patient KEK', async () => {
      // Arrange
      const patientId = 'patient-unwrap-4';
      const dek = crypto.randomBytes(32);
      service.initializeTestKeks([patientId]);
      const wrappedDek = await service.wrapDek(dek, patientId);

      // Act
      const unwrappedDek = await service.unwrapDek(wrappedDek, patientId);

      // Assert - decryption should return the original DEK
      expect(unwrappedDek.equals(dek)).toBe(true);
      expect(unwrappedDek.length).toBe(32); // 256-bit DEK
    });

    it('should verify authentication tag', async () => {
      // Arrange
      const patientId = 'patient-unwrap-5';
      const dek = crypto.randomBytes(32);
      service.initializeTestKeks([patientId]);
      const wrappedDek = await service.wrapDek(dek, patientId);

      // Corrupt the auth tag (last 16 bytes)
      const corruptedWrappedDek = Buffer.from(wrappedDek);
      corruptedWrappedDek[wrappedDek.length - 1] ^= 0xFF; // Flip bits in last byte

      // Act & Assert - should throw because auth tag is invalid
      await expect(service.unwrapDek(corruptedWrappedDek, patientId)).rejects.toThrow(
        KeyManagementError
      );
    });

    it('should return plaintext DEK as Buffer', async () => {
      // Arrange
      const patientId = 'patient-unwrap-6';
      const dek = crypto.randomBytes(32);
      service.initializeTestKeks([patientId]);
      const wrappedDek = await service.wrapDek(dek, patientId);

      // Act
      const unwrappedDek = await service.unwrapDek(wrappedDek, patientId);

      // Assert
      expect(unwrappedDek).toBeInstanceOf(Buffer);
      expect(unwrappedDek.length).toBe(32);
      expect(unwrappedDek.equals(dek)).toBe(true);
    });

    it('should throw KeyManagementError if KEK not found', async () => {
      // Arrange
      const patientId = 'patient-unwrap-7';
      const dek = crypto.randomBytes(32);
      service.initializeTestKeks([patientId]);
      const wrappedDek = await service.wrapDek(dek, patientId);

      const nonexistentPatientId = 'nonexistent-patient';

      // Act & Assert
      await expect(service.unwrapDek(wrappedDek, nonexistentPatientId)).rejects.toThrow(
        KeyManagementError
      );
      await expect(service.unwrapDek(wrappedDek, nonexistentPatientId)).rejects.toThrow(
        `KEK not found for patient ${nonexistentPatientId}`
      );
    });

    it('should throw KeyManagementError if decryption fails due to corrupted ciphertext', async () => {
      // Arrange
      const patientId = 'patient-unwrap-8';
      const dek = crypto.randomBytes(32);
      service.initializeTestKeks([patientId]);
      const wrappedDek = await service.wrapDek(dek, patientId);

      // Corrupt the encrypted DEK portion (bytes 12 to 44)
      const corruptedWrappedDek = Buffer.from(wrappedDek);
      corruptedWrappedDek[20] ^= 0xFF; // Flip bits in the encrypted DEK

      // Act & Assert
      await expect(service.unwrapDek(corruptedWrappedDek, patientId)).rejects.toThrow(
        KeyManagementError
      );
    });

    it('should throw KeyManagementError if Buffer is too short', async () => {
      // Arrange
      const patientId = 'patient-unwrap-9';
      service.initializeTestKeks([patientId]);

      // Create a buffer that's too short (less than 28 bytes: 12 IV + 16 auth tag)
      const invalidBuffer = Buffer.alloc(20);

      // Act & Assert
      await expect(service.unwrapDek(invalidBuffer, patientId)).rejects.toThrow(
        KeyManagementError
      );
    });

    it('should handle round-trip for multiple different DEKs', async () => {
      // Arrange
      const patientId = 'patient-unwrap-10';
      service.initializeTestKeks([patientId]);

      // Act & Assert - test multiple DEKs
      for (let i = 0; i < 5; i++) {
        const dek = crypto.randomBytes(32);
        const wrappedDek = await service.wrapDek(dek, patientId);
        const unwrappedDek = await service.unwrapDek(wrappedDek, patientId);
        expect(unwrappedDek.equals(dek)).toBe(true);
      }
    });
  });

  describe('getDekVersion', () => {
    it('should accept patientId string as parameter', () => {
      // Arrange
      const patientId = 'patient-version-1';

      // Act
      const version = service.getDekVersion(patientId);

      // Assert
      expect(typeof patientId).toBe('string');
      expect(version).toBeDefined();
    });

    it('should return current DEK version identifier as string', () => {
      // Arrange
      const patientId = 'patient-version-2';

      // Act
      const version = service.getDekVersion(patientId);

      // Assert
      expect(typeof version).toBe('string');
      expect(version.length).toBeGreaterThan(0);
    });

    it('should return version identifier in expected format', () => {
      // Arrange
      const patientId = 'patient-version-3';

      // Act
      const version = service.getDekVersion(patientId);

      // Assert
      expect(version).toBe('v1'); // Current implementation returns 'v1'
      expect(version).toMatch(/^v\d+$/); // Should match pattern v{number}
    });

    it('should return consistent version for same patient', () => {
      // Arrange
      const patientId = 'patient-version-4';

      // Act
      const version1 = service.getDekVersion(patientId);
      const version2 = service.getDekVersion(patientId);
      const version3 = service.getDekVersion(patientId);

      // Assert
      expect(version1).toBe(version2);
      expect(version2).toBe(version3);
    });

    it('should return version for different patients', () => {
      // Arrange
      const patientId1 = 'patient-version-5';
      const patientId2 = 'patient-version-6';

      // Act
      const version1 = service.getDekVersion(patientId1);
      const version2 = service.getDekVersion(patientId2);

      // Assert
      expect(version1).toBeDefined();
      expect(version2).toBeDefined();
      expect(typeof version1).toBe('string');
      expect(typeof version2).toBe('string');
      // Currently returns same version for all patients
      expect(version1).toBe(version2);
    });

    it('should return non-empty string', () => {
      // Arrange
      const patientId = 'patient-version-7';

      // Act
      const version = service.getDekVersion(patientId);

      // Assert
      expect(version).toBeTruthy();
      expect(version.length).toBeGreaterThan(0);
    });

    it('should work without requiring KEK initialization', () => {
      // Arrange
      const patientId = 'patient-version-8';
      // Note: Not initializing KEK for this patient

      // Act
      const version = service.getDekVersion(patientId);

      // Assert - should still return version even if KEK doesn't exist
      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
    });
  });
});
