import { Injectable } from '@nestjs/common';
import { KeyManagementError } from '../errors';
import * as crypto from 'crypto';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';

/**
 * Key Management Service
 * 
 * Manages Key Encryption Keys (KEKs) and performs Data Encryption Key (DEK) 
 * wrapping and unwrapping operations. This service is responsible for:
 * - Storing patient-specific KEKs
 * - Encrypting DEKs with patient KEKs (wrapping)
 * - Decrypting DEKs with patient KEKs (unwrapping)
 * - Providing DEK version information
 * 
 * In production, this service would integrate with a Hardware Security Module (HSM)
 * or cloud KMS (AWS KMS, Azure Key Vault, Google Cloud KMS). For development and
 * testing, KEKs are stored in-memory.
 * 
 * Requirements: 8.3, 13.5
 */
@Injectable()
export class KeyManagementService {
  /**
   * In-memory storage for patient-specific KEKs
   * Key: patientId, Value: 256-bit KEK as Buffer
   * 
   * In production, this would be replaced with HSM/KMS integration
   */
  private readonly keks: Map<string, Buffer> = new Map();

  /**
   * Current DEK version identifier
   * Used for key rotation and cryptographic agility
   */
  private readonly currentDekVersion = 'v1';

  constructor(private readonly circuitBreaker: CircuitBreakerService) { }

  /**
   * Initialize KEKs for test patients
   * 
   * This method generates and stores KEKs for a set of test patient IDs.
   * Useful for development, testing, and demo purposes.
   * 
   * @param patientIds - Array of patient IDs to initialize KEKs for
   */
  initializeTestKeks(patientIds: string[]): void {
    for (const patientId of patientIds) {
      // Generate a 256-bit (32 byte) KEK for each patient
      const kek = crypto.randomBytes(32);
      this.keks.set(patientId, kek);
    }
  }

  /**
   * Encrypts a DEK using the patient's KEK (wrapping)
   * 
   * This method:
   * 1. Retrieves the patient's KEK from storage
   * 2. Generates a unique IV for the wrapping operation
   * 3. Encrypts the DEK using AES-256-GCM with the KEK
   * 4. Returns a Buffer containing: IV (12 bytes) + encrypted DEK + auth tag (16 bytes)
   * 
   * @param dek - The plaintext Data Encryption Key to wrap
   * @param patientId - The patient identifier for KEK selection
   * @returns Promise resolving to the encrypted DEK with IV and auth tag
   * @throws KeyManagementError if KEK not found or encryption fails
   * 
   * Requirements: 4.1, 4.2, 4.3, 13.1, 13.3
   */
  async wrapDek(dek: Buffer, patientId: string): Promise<Buffer> {
    return this.circuitBreaker.execute('kms', async () => {
      // Retrieve the patient's KEK
      const kek = this.keks.get(patientId);
      if (!kek) {
        throw new KeyManagementError(
          `KEK not found for patient ${patientId}. Ensure KEK is initialized.`
        );
      }

      try {
        // Generate a unique 12-byte IV for this wrapping operation
        const iv = crypto.randomBytes(12);

        // Create AES-256-GCM cipher with the KEK
        const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);

        // Encrypt the DEK
        const encryptedDek = Buffer.concat([
          cipher.update(dek),
          cipher.final(),
        ]);

        // Get the authentication tag
        const authTag = cipher.getAuthTag();

        // Return IV + encrypted DEK + auth tag as a single Buffer
        return Buffer.concat([iv, encryptedDek, authTag]);
      } catch (error) {
        throw new KeyManagementError(
          `Failed to wrap DEK for patient ${patientId}: ${error.message}`
        );
      }
    });
  }

  /**
   * Decrypts a DEK using the patient's KEK (unwrapping)
   * 
   * This method:
   * 1. Retrieves the patient's KEK from storage
   * 2. Extracts the IV, encrypted DEK, and auth tag from the input Buffer
   * 3. Decrypts the DEK using AES-256-GCM with the KEK
   * 4. Verifies the authentication tag
   * 5. Returns the plaintext DEK
   * 
   * @param encryptedDek - Buffer containing IV + encrypted DEK + auth tag
   * @param patientId - The patient identifier for KEK selection
   * @returns Promise resolving to the plaintext DEK
   * @throws KeyManagementError if KEK not found, decryption fails, or auth tag invalid
   * 
   * Requirements: 7.1, 13.2, 13.4
   */
  async unwrapDek(encryptedDek: Buffer, patientId: string): Promise<Buffer> {
    return this.circuitBreaker.execute('kms', async () => {
      // Retrieve the patient's KEK
      const kek = this.keks.get(patientId);
      if (!kek) {
        throw new KeyManagementError(
          `KEK not found for patient ${patientId}. Ensure KEK is initialized.`
        );
      }

      try {
        // Extract components from the encrypted DEK buffer
        // Format: IV (12 bytes) + encrypted DEK + auth tag (16 bytes)
        const iv = encryptedDek.subarray(0, 12);
        const authTag = encryptedDek.subarray(encryptedDek.length - 16);
        const ciphertext = encryptedDek.subarray(12, encryptedDek.length - 16);

        // Create AES-256-GCM decipher with the KEK
        const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);

        // Set the authentication tag for verification
        decipher.setAuthTag(authTag);

        // Decrypt the DEK
        const dek = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);

        return dek;
      } catch (error) {
        throw new KeyManagementError(
          `Failed to unwrap DEK for patient ${patientId}: ${error.message}`
        );
      }
    });
  }

  /**
   * Retrieves the current DEK version identifier
   * 
   * The version identifier supports key rotation and cryptographic agility.
   * When keys are rotated, this version can be incremented (e.g., v1 -> v2).
   * 
   * @param patientId - The patient identifier (for future per-patient versioning)
   * @returns The version string for the current DEK encryption scheme
   * 
   * Requirements: 14.3
   */
  getDekVersion(patientId: string): string {
    // For now, return a constant version
    // In production, this could be per-patient or time-based
    return this.currentDekVersion;
  }

  /**
   * Adds or updates a KEK for a specific patient
   * 
   * This method is useful for:
   * - Adding KEKs for new patients
   * - Rotating KEKs for existing patients
   * - Testing with specific KEK values
   * 
   * @param patientId - The patient identifier
   * @param kek - The 256-bit KEK as a Buffer (must be 32 bytes)
   * @throws Error if KEK is not 32 bytes
   */
  setKek(patientId: string, kek: Buffer): void {
    if (kek.length !== 32) {
      throw new Error('KEK must be exactly 32 bytes (256 bits)');
    }
    this.keks.set(patientId, kek);
  }

  /**
   * Checks if a KEK exists for a patient
   * 
   * @param patientId - The patient identifier
   * @returns true if KEK exists, false otherwise
   */
  hasKek(patientId: string): boolean {
    return this.keks.has(patientId);
  }

  /**
   * Removes a KEK for a patient
   * 
   * Use with caution: removing a KEK will make all encrypted DEKs
   * for that patient unrecoverable.
   * 
   * @param patientId - The patient identifier
   * @returns true if KEK was removed, false if it didn't exist
   */
  removeKek(patientId: string): boolean {
    return this.keks.delete(patientId);
  }

  /**
   * Gets the number of KEKs currently stored
   * 
   * Useful for testing and monitoring
   * 
   * @returns The count of stored KEKs
   */
  getKekCount(): number {
    return this.keks.size;
  }
}
