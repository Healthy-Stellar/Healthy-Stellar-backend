import { Module } from '@nestjs/common';
import { EncryptionService } from './services/encryption.service';
import { KeyManagementService } from './services/key-management.service';
import { PhiColumnEncryptionService } from './services/phi-column-encryption.service';

/**
 * Encryption Module
 * 
 * This module encapsulates the envelope encryption functionality for medical records.
 * It provides the EncryptionService for encrypting and decrypting medical record payloads,
 * while keeping the KeyManagementService private to enforce security boundaries.
 * 
 * Module Configuration:
 * - Providers: EncryptionService, KeyManagementService, PhiColumnEncryptionService
 * - Exports: EncryptionService, PhiColumnEncryptionService
 * 
 * PhiColumnEncryptionService is exported so that entity modules (Patient, MedicalRecord)
 * can use it for field-level PHI encryption via the key-management system.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
@Module({
  providers: [
    EncryptionService,
    KeyManagementService,
    PhiColumnEncryptionService,
  ],
  exports: [
    EncryptionService,
    PhiColumnEncryptionService,
    // KeyManagementService is NOT exported - it's private to this module
  ],
})
export class EncryptionModule {}