import { Module } from '@nestjs/common';
import { EncryptionService } from './services/encryption.service';
import { KeyManagementService } from './services/key-management.service';
import { PhiColumnEncryptionService } from './services/phi-column-encryption.service';
import { DeterministicEncryptionService } from './services/deterministic-encryption.service';

/**
 * Encryption Module
 *
 * Provides:
 *  - EncryptionService          — envelope encryption for medical record payloads
 *  - PhiColumnEncryptionService — field-level PHI encryption via key-management
 *  - DeterministicEncryptionService — AES-256-GCM deterministic mode (HMAC-derived IV)
 *    for exact-match queries on high-cardinality PHI fields (SSN, MRN, passport number)
 *
 * KeyManagementService is intentionally NOT exported — it is private to this module
 * to enforce the security boundary around KEK material.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
@Module({
  providers: [
    EncryptionService,
    KeyManagementService,
    PhiColumnEncryptionService,
    DeterministicEncryptionService,
  ],
  exports: [
    EncryptionService,
    PhiColumnEncryptionService,
    DeterministicEncryptionService,
  ],
})
export class EncryptionModule {}
