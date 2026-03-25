import { Module } from '@nestjs/common';
import { EncryptionService } from './services/encryption.service';
import { KeyManagementService } from './services/key-management.service';

/**
 * Encryption Module
 * 
 * This module encapsulates the envelope encryption functionality for medical records.
 * It provides the EncryptionService for encrypting and decrypting medical record payloads,
 * while keeping the KeyManagementService private to enforce security boundaries.
 * 
 * Module Configuration:
 * - Providers: EncryptionService and KeyManagementService
 * - Exports: Only EncryptionService (KeyManagementService is private)
 * 
 * This configuration ensures that KeyManagementService can only be accessed through
 * EncryptionService, enforcing the security boundary specified in Requirement 8.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
@Module({
  providers: [
    EncryptionService,
    KeyManagementService,
  ],
  exports: [
    EncryptionService,
    // KeyManagementService is NOT exported - it's private to this module
  ],
})
export class EncryptionModule {}
