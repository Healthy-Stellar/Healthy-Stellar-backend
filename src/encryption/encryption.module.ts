import { Module } from '@nestjs/common';
import { EncryptionService } from './services/encryption.service';
import { KeyManagementService } from './services/key-management.service';
import { PhiColumnEncryptionService } from './services/phi-column-encryption.service';
import { DeterministicEncryptionService } from './services/deterministic-encryption.service';
import { PersistentKeyManagementService } from './services/persistent-key-management.service';
import { KeyStoreModule } from '../key-management/key-store.module';

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
  imports: [KeyStoreModule],
  providers: [
    EncryptionService,
    // KEKs are persisted through the key-management KeyStore (DB or AWS KMS).
    // The in-memory KeyManagementService class is only the DI token here and
    // is used directly in unit tests.
    { provide: KeyManagementService, useClass: PersistentKeyManagementService },
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
