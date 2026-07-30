import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PhiColumnEncryptionService } from './phi-column-encryption.service';
import {
  isDeterministicEligible,
  PHI_FIELD_REGISTRY,
  PhiFieldConfig,
} from './phi-field-registry';

/**
 * DeterministicEncryptionService — wraps PhiColumnEncryptionService to provide
 * AES-256-GCM deterministic encryption (HMAC-derived IV) for eligible PHI fields,
 * enabling exact-match database queries without decrypting every row.
 *
 * The deterministic IV derivation (HMAC-SHA256(DEK, plaintext)[0..12]) provides
 * the same searchability guarantee as AES-SIV: identical plaintexts produce
 * identical ciphertexts under the same key, while the GCM auth tag still
 * protects integrity.
 *
 * All field eligibility decisions are delegated to PHI_FIELD_REGISTRY so that
 * low-cardinality fields (gender, blood type) can never be accidentally
 * encrypted in deterministic mode.
 */
@Injectable()
export class DeterministicEncryptionService {
  private readonly logger = new Logger(DeterministicEncryptionService.name);

  constructor(private readonly phiEncryption: PhiColumnEncryptionService) {}

  /**
   * Encrypt a PHI field value using the mode appropriate for that field.
   * Throws if deterministic mode is requested for an ineligible field.
   */
  async encryptField(
    patientId: string,
    fieldName: string,
    value: string,
    forceDeterministic = false,
  ): Promise<string> {
    const deterministic = forceDeterministic || isDeterministicEligible(fieldName);

    if (forceDeterministic && !isDeterministicEligible(fieldName)) {
      throw new BadRequestException(
        `Field "${fieldName}" is not eligible for deterministic encryption — ` +
          `use randomised mode to avoid inference attacks on low-cardinality data`,
      );
    }

    return this.phiEncryption.encryptField(patientId, value, deterministic);
  }

  /**
   * Decrypt a PHI field value, trying both deterministic and randomised modes.
   */
  async decryptField(patientId: string, ciphertext: string): Promise<string | null> {
    return this.phiEncryption.decryptField(patientId, ciphertext);
  }

  /**
   * Compute an HMAC index for an exact-match lookup on a deterministic field.
   * Store this alongside the encrypted column so queries can do:
   *   WHERE national_id_idx = computeSearchIndex(patientId, plaintext)
   */
  async computeSearchIndex(patientId: string, fieldName: string, value: string): Promise<string> {
    if (!isDeterministicEligible(fieldName)) {
      throw new BadRequestException(
        `Field "${fieldName}" does not support exact-match index lookup`,
      );
    }
    return this.phiEncryption.computeHmacIndex(patientId, value);
  }

  /**
   * Re-encrypt an existing randomised ciphertext into deterministic mode.
   * Used by the migration path when a field is promoted to searchable.
   */
  async reEncryptToDeterministic(
    patientId: string,
    fieldName: string,
    existingCiphertext: string,
  ): Promise<{ ciphertext: string; searchIndex: string }> {
    if (!isDeterministicEligible(fieldName)) {
      throw new BadRequestException(
        `Field "${fieldName}" is not eligible for deterministic re-encryption`,
      );
    }

    const plaintext = await this.phiEncryption.decryptField(patientId, existingCiphertext);
    if (plaintext === null) {
      throw new Error(`Failed to decrypt existing ciphertext for patient ${patientId}`);
    }

    const [ciphertext, searchIndex] = await Promise.all([
      this.phiEncryption.encryptField(patientId, plaintext, true),
      this.phiEncryption.computeHmacIndex(patientId, plaintext),
    ]);

    this.logger.log(`Re-encrypted field "${fieldName}" to deterministic mode for patient ${patientId}`);
    return { ciphertext, searchIndex };
  }

  /**
   * Returns the field registry for documentation / API exposure.
   */
  getFieldRegistry(): Record<string, PhiFieldConfig> {
    return PHI_FIELD_REGISTRY;
  }

  /**
   * Benchmark: compare decrypt-and-scan vs index lookup for a batch of records.
   * Returns timing information for observability.
   */
  async benchmarkLookup(
    patientId: string,
    fieldName: string,
    searchValue: string,
    encryptedDataset: string[],
  ): Promise<{ indexLookupMs: number; decryptScanMs: number; datasetSize: number }> {
    const startIndex = Date.now();
    const targetIndex = await this.phiEncryption.computeHmacIndex(patientId, searchValue);
    let indexMatches = 0;
    for (const ciphertext of encryptedDataset) {
      const idx = await this.phiEncryption.computeHmacIndex(
        patientId,
        (await this.phiEncryption.decryptField(patientId, ciphertext)) ?? '',
      );
      if (idx === targetIndex) indexMatches++;
    }
    const indexLookupMs = Date.now() - startIndex;

    const startScan = Date.now();
    let scanMatches = 0;
    for (const ciphertext of encryptedDataset) {
      const plain = await this.phiEncryption.decryptField(patientId, ciphertext);
      if (plain === searchValue) scanMatches++;
    }
    const decryptScanMs = Date.now() - startScan;

    this.logger.log(
      `Benchmark [${fieldName}] dataset=${encryptedDataset.length}: ` +
        `index=${indexLookupMs}ms (${indexMatches} hits), scan=${decryptScanMs}ms (${scanMatches} hits)`,
    );

    return { indexLookupMs, decryptScanMs, datasetSize: encryptedDataset.length };
  }
}
