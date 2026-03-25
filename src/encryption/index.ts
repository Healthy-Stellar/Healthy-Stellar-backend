/**
 * Encryption Module Exports
 * 
 * This file exports the public API of the encryption module.
 * Only EncryptionService and related interfaces/errors are exported.
 * KeyManagementService is NOT exported to maintain encapsulation.
 */

export { EncryptionModule } from './encryption.module';
export { EncryptionService } from './services/encryption.service';
export { EncryptedRecord } from './interfaces';
export {
  EncryptionServiceError,
  EncryptionError,
  DecryptionError,
  AuthenticationError,
  KeyManagementError,
  ValidationError,
} from './errors';
