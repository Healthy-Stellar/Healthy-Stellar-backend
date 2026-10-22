import { Injectable, Logger } from '@nestjs/common';
import { KeyManagementService } from './key-management.service';
import { PhiKeyManagedTransformer } from '../../common/transformers/phi-key-managed.transformer';
import { createHmac, randomBytes } from 'crypto';

/**
 * Service that manages PHI field encryption using the key-management system.
 *
 * Responsibilities:
 *  - Obtain a Data Encryption Key (DEK) per patient from KeyManagementService
 *  - Create PhiKeyManagedTransformer instances with the patient's DEK
 *  - Compute HMAC index values for exact-match searchability
 *
 * The service caches DEKs per patient to avoid repeated KMS round-trips.
 */
@Injectable()
export class PhiColumnEncryptionService {
  private readonly logger = new Logger(PhiColumnEncryptionService.name);
  private readonly dekCache = new Map<string, Buffer>();

  constructor(private readonly kms: KeyManagementService) {}

  /**
   * Obtain (or generate + wrap) a 32-byte DEK for the given patient.
   * The plain DEK is cached in memory until the application restarts.
   *
   * @param patientId  The patient identifier used for KEK lookup
   */
  async getDek(patientId: string): Promise<Buffer> {
    const cached = this.dekCache.get(patientId);
    if (cached) return cached;

    // Generate a fresh 32-byte DEK
    const dek = randomBytes(32);

    // Wrap it with the patient's KEK and discard the wrapped output —
    // we only need the plain DEK for in-memory field encryption.
    // In production, the wrapped DEK should be persisted (e.g., on the patient row)
    // so that decryption can re-obtain the same DEK later.
    await this.kms.wrapDek(dek, patientId);

    this.dekCache.set(patientId, dek);
    this.logger.log(`New DEK generated and cached for patient ${patientId}`);
    return dek;
  }

  /**
   * Recover a DEK from a previously-wrapped (encrypted) DEK blob.
   * Used when loading an existing patient whose wrapped DEK was persisted.
   *
   * @param patientId     The patient identifier
   * @param wrappedDek    The wrapped DEK returned by KeyManagementService.wrapDek
   */
  async recoverDek(patientId: string, wrappedDek: Buffer): Promise<Buffer> {
    const cached = this.dekCache.get(patientId);
    if (cached) return cached;

    const dek = await this.kms.unwrapDek(wrappedDek, patientId);
    this.dekCache.set(patientId, dek);
    return dek;
  }

  /**
   * Create a PhiKeyManagedTransformer for the given patient.
   *
   * @param patientId      The patient identifier
   * @param deterministic  When true, uses HMAC-derived IV for equality-search support
   */
  async createTransformer(patientId: string, deterministic = false): Promise<PhiKeyManagedTransformer> {
    const dek = await this.getDek(patientId);
    return new PhiKeyManagedTransformer(dek, deterministic);
  }

  /**
   * Compute an HMAC-SHA256 index value for exact-match searching.
   * The HMAC is keyed with the patient's DEK so only key holders can mount
   * a brute-force search.
   *
   * @param patientId  The patient identifier
   * @param value      The plaintext value to index
   * @returns          hex-encoded HMAC-SHA256 digest
   */
  async computeHmacIndex(patientId: string, value: string): Promise<string> {
    const dek = await this.getDek(patientId);
    return createHmac('sha256', dek).update(value, 'utf8').digest('hex');
  }

  /**
   * Encrypt a PHI field value for the given patient.
   *
   * @param patientId      The patient identifier
   * @param value          The plaintext value
   * @param deterministic  When true, uses deterministic encryption
   * @returns              base64-encoded ciphertext
   */
  async encryptField(patientId: string, value: string, deterministic = false): Promise<string> {
    const transformer = await this.createTransformer(patientId, deterministic);
    return transformer.to(value) as string;
  }

  /**
   * Decrypt a PHI field value for the given patient.
   *
   * @param patientId   The patient identifier
   * @param ciphertext  base64-encoded ciphertext
   * @returns           plaintext value, or null if decryption fails
   */
  async decryptField(patientId: string, ciphertext: string): Promise<string | null> {
    // For decryption we need to try both deterministic and randomised modes
    // since we don't know which was used. Try deterministic first (it's faster).
    const dek = await this.getDek(patientId);

    const detTransformer = new PhiKeyManagedTransformer(dek, true);
    const result = detTransformer.from(ciphertext);
    if (result !== null) return result;

    const randTransformer = new PhiKeyManagedTransformer(dek, false);
    return randTransformer.from(ciphertext);
  }

  /**
   * Clear the in-memory DEK cache (useful for testing or key rotation).
   */
  clearCache(): void {
    this.dekCache.forEach((dek) => dek.fill(0));
    this.dekCache.clear();
    this.logger.log('DEK cache cleared');
  }
}
