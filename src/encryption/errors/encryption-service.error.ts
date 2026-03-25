/**
 * Base error class for all encryption service errors
 * 
 * This is the root of the error hierarchy for the envelope encryption system.
 * All specific error types extend from this base class.
 * 
 * Requirements: 7.4, 11.1, 11.2
 */
export class EncryptionServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionServiceError';
  }
}

/**
 * Error thrown during encryption operations
 * 
 * Examples:
 * - DEK generation failure
 * - Cipher creation failure
 * - Invalid cryptographic parameters
 */
export class EncryptionError extends EncryptionServiceError {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * Error thrown during decryption operations
 * 
 * Examples:
 * - Decipher creation failure
 * - Invalid encrypted record structure
 * - Decryption process failure
 */
export class DecryptionError extends EncryptionServiceError {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

/**
 * Error thrown when authentication tag verification fails
 * 
 * This indicates potential data corruption or tampering.
 * Extends DecryptionError as it occurs during decryption.
 * 
 * Requirements: 7.4, 11.1
 */
export class AuthenticationError extends DecryptionError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown during key management operations
 * 
 * Examples:
 * - KEK not found for patient
 * - DEK wrapping failure
 * - DEK unwrapping failure
 * - KMS unavailable
 * 
 * Requirements: 11.2
 */
export class KeyManagementError extends EncryptionServiceError {
  constructor(message: string) {
    super(message);
    this.name = 'KeyManagementError';
  }
}

/**
 * Error thrown when validation fails
 * 
 * Examples:
 * - Missing required fields in encrypted record
 * - Invalid field types
 * - Malformed data structures
 */
export class ValidationError extends EncryptionServiceError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
