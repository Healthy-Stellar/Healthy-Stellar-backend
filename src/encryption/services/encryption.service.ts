import { Injectable, Logger } from '@nestjs/common';
import { KeyManagementService } from './key-management.service';
import { EncryptedRecord } from '../interfaces';
import { 
  EncryptionError, 
  DecryptionError, 
  AuthenticationError, 
  ValidationError 
} from '../errors';
import * as crypto from 'crypto';

/**
 * Encryption Service
 * 
 * The primary service responsible for all medical record encryption and decryption
 * operations using envelope encryption. This service orchestrates:
 * - Generation of unique Data Encryption Keys (DEKs) for each record
 * - Encryption of medical record payloads using AES-256-GCM
 * - Wrapping DEKs with patient-specific Key Encryption Keys (KEKs)
 * - Decryption of medical records using unwrapped DEKs
 * 
 * This service is the sole caller of KeyManagementService, enforcing the security
 * boundary specified in Requirement 8.1.
 * 
 * Requirements: 1.5, 8.1
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);

  /**
   * Constructor with KeyManagementService injection
   * 
   * @param kms - The Key Management Service for DEK wrapping/unwrapping operations
   */
  constructor(private readonly kms: KeyManagementService) {}

  /**
   * Encrypts a medical record payload using envelope encryption
   * 
   * This method will:
   * 1. Generate a unique 256-bit DEK using crypto.randomBytes
   * 2. Generate a unique 12-byte IV using crypto.randomBytes
   * 3. Encrypt the payload using AES-256-GCM with the DEK and IV
   * 4. Extract the authentication tag from the encryption operation
   * 5. Call kms.wrapDek to encrypt the DEK with the patient's KEK
   * 6. Assemble and return the EncryptedRecord structure
   * 7. Clear the plaintext DEK from memory
   * 
   * @param payload - The medical record data to encrypt
   * @param patientId - The patient identifier for KEK selection
   * @returns Promise resolving to an EncryptedRecord structure
   * 
   * Requirements: 1.1, 1.3
   */
  async encryptRecord(payload: Buffer, patientId: string): Promise<EncryptedRecord> {
    try {
      // Generate a unique 32-byte (256-bit) DEK using cryptographically secure random
      const dek = crypto.randomBytes(32);

      // Validate DEK size (Requirements 2.1, 3.2, 10.1)
      if (dek.length !== 32) {
        throw new EncryptionError(
          `DEK generation failed: expected 32 bytes, got ${dek.length} bytes`
        );
      }

      // Generate a unique 12-byte IV for AES-256-GCM
      const iv = crypto.randomBytes(12);

      // Validate IV size (Requirements 2.1, 3.2, 10.1)
      if (iv.length !== 12) {
        throw new EncryptionError(
          `IV generation failed: expected 12 bytes, got ${iv.length} bytes`
        );
      }

      // Create AES-256-GCM cipher with the DEK and IV
      const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);

      // Encrypt the payload
      const ciphertext = Buffer.concat([
        cipher.update(payload),
        cipher.final(),
      ]);

      // Extract the authentication tag (16 bytes)
      const authTag = cipher.getAuthTag();

      // Validate auth tag size (Requirements 2.1, 3.2, 10.1)
      if (authTag.length !== 16) {
        throw new EncryptionError(
          `Auth tag generation failed: expected 16 bytes, got ${authTag.length} bytes`
        );
      }

      // Call KMS to wrap (encrypt) the DEK with the patient's KEK
      const encryptedDek = await this.kms.wrapDek(dek, patientId);

      // Get the DEK version identifier from KMS
      const dekVersion = this.kms.getDekVersion(patientId);

      // Clear the plaintext DEK from memory for security
      dek.fill(0);

      // Assemble and return the EncryptedRecord structure
      return {
        iv,
        ciphertext,
        authTag,
        encryptedDek,
        dekVersion,
      };
    } catch (error) {
      // If error is already a KeyManagementError, rethrow it
      if (error.name === 'KeyManagementError') {
        throw error;
      }
      // Otherwise, wrap in EncryptionError
      throw new EncryptionError(
        `Failed to encrypt record: ${error.message}`
      );
    }
  }


  /**
   * Decrypts a medical record using the encrypted DEK
   * 
   * This method will:
   * 1. Validate EncryptedRecord structure (all fields present and non-empty)
   * 2. Call kms.unwrapDek to decrypt the encrypted DEK with the patient's KEK
   * 3. Create an AES-256-GCM decipher with the DEK and IV
   * 4. Set the authentication tag for verification
   * 5. Decrypt the ciphertext
   * 6. Verify the authentication tag (throws error if verification fails)
   * 7. Clear the plaintext DEK from memory
   * 8. Return the plaintext payload
   * 
   * @param encryptedRecord - The encrypted record structure
   * @param patientId - The patient identifier for KEK selection
   * @returns Promise resolving to the plaintext payload
   * @throws ValidationError if EncryptedRecord is malformed
   * @throws AuthenticationError if auth tag verification fails
   * @throws DecryptionError on other failures
   * 
   * Requirements: 1.2, 1.4, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 11.1, 11.2, 11.4
   */
  async decryptRecord(encryptedRecord: EncryptedRecord, patientId: string): Promise<Buffer> {
    // Validate EncryptedRecord structure (all fields present and non-empty)
    if (!encryptedRecord) {
      throw new ValidationError('EncryptedRecord is null or undefined');
    }

    if (!encryptedRecord.iv || encryptedRecord.iv.length === 0) {
      throw new ValidationError('EncryptedRecord is malformed: iv is missing or empty');
    }

    if (!encryptedRecord.ciphertext || encryptedRecord.ciphertext.length === 0) {
      throw new ValidationError('EncryptedRecord is malformed: ciphertext is missing or empty');
    }

    if (!encryptedRecord.authTag || encryptedRecord.authTag.length === 0) {
      throw new ValidationError('EncryptedRecord is malformed: authTag is missing or empty');
    }

    if (!encryptedRecord.encryptedDek || encryptedRecord.encryptedDek.length === 0) {
      throw new ValidationError('EncryptedRecord is malformed: encryptedDek is missing or empty');
    }

    if (!encryptedRecord.dekVersion || encryptedRecord.dekVersion.trim().length === 0) {
      throw new ValidationError('EncryptedRecord is malformed: dekVersion is missing or empty');
    }

    let dek: Buffer | null = null;

    try {
      // Call KMS to unwrap (decrypt) the DEK using the patient's KEK
      dek = await this.kms.unwrapDek(encryptedRecord.encryptedDek, patientId);

      // Create AES-256-GCM decipher with the DEK and IV
      const decipher = crypto.createDecipheriv('aes-256-gcm', dek, encryptedRecord.iv);

      // Set the authentication tag on the decipher for verification
      decipher.setAuthTag(encryptedRecord.authTag);

      // Decrypt the ciphertext
      // Note: If auth tag verification fails, decipher.final() will throw an error
      const plaintext = Buffer.concat([
        decipher.update(encryptedRecord.ciphertext),
        decipher.final(),
      ]);

      // Clear the plaintext DEK from memory for security
      dek.fill(0);

      // Return the plaintext payload
      return plaintext;
    } catch (error) {
      // Clear DEK from memory if it was allocated
      if (dek) {
        dek.fill(0);
      }

      // If error is already a KeyManagementError, log and rethrow it
      if (error.name === 'KeyManagementError') {
        // Log security event for audit trail (Requirement 11.3)
        // Ensure no sensitive data (plaintext, keys) is logged (Requirement 11.4)
        this.logger.warn(
          `Failed to unwrap DEK for patient ${patientId}. ` +
          `Encrypted DEK may be invalid or corrupted. ` +
          `Record details: encryptedDek_length=${encryptedRecord.encryptedDek.length}, ` +
          `dekVersion=${encryptedRecord.dekVersion}`
        );
        throw error;
      }

      // Check if this is an authentication tag verification failure
      // Node.js crypto throws an error with message containing "Unsupported state or unable to authenticate data"
      if (error.message && (
        error.message.includes('Unsupported state') ||
        error.message.includes('unable to authenticate') ||
        error.message.includes('auth')
      )) {
        // Log security event for audit trail (Requirement 11.3)
        // Ensure no sensitive data (plaintext, keys) is logged (Requirement 11.4)
        this.logger.warn(
          `Authentication tag verification failed for patient ${patientId}. ` +
          `Data may be corrupted or tampered. ` +
          `Record details: iv_length=${encryptedRecord.iv.length}, ` +
          `ciphertext_length=${encryptedRecord.ciphertext.length}, ` +
          `authTag_length=${encryptedRecord.authTag.length}, ` +
          `dekVersion=${encryptedRecord.dekVersion}`
        );
        
        throw new AuthenticationError(
          'Authentication tag verification failed - data may be corrupted or tampered'
        );
      }

      // Otherwise, wrap in DecryptionError
      throw new DecryptionError(
        `Failed to decrypt record: ${error.message}`
      );
    }
  }
}
