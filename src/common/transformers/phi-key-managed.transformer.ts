import { ValueTransformer } from 'typeorm';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

const IV_LEN = 12;
const TAG_LEN = 16;
const SALT_LEN = 16;
const VERSION_BYTE = 0x01;

/**
 * Layout for randomised mode (free-text PHI: notes, prescriptionDetails):
 *   version(1) | salt(16) | iv(12) | tag(16) | ciphertext
 *
 * Layout for deterministic mode (searchable PHI: ssn):
 *   version(1) | iv(12) | tag(16) | ciphertext
 *   (IV = HMAC-SHA256(DEK, plaintext) truncated to 12 bytes)
 */

/**
 * AES-256-GCM transformer for PHI column encryption using a pre-obtained
 * Data Encryption Key (DEK). Intended to be used with the key-management
 * system instead of reading ENCRYPTION_KEY directly.
 *
 * When `deterministic` is true, the IV is derived via HMAC-SHA256 so that
 * identical plaintexts produce identical ciphertexts, enabling equality-based
 * indexed lookups. Use this only for low-cardinality, coded identifiers (e.g., SSN).
 *
 * When `deterministic` is false (default), a random IV is used — suitable for
 * free-text fields (notes, prescription details).
 */
export class PhiKeyManagedTransformer implements ValueTransformer {
  private readonly dek: Buffer;
  private readonly deterministic: boolean;

  /**
   * @param dek                32-byte Data Encryption Key
   * @param deterministic      When true uses HMAC-derived IV for equality-search support
   */
  constructor(dek: Buffer, deterministic = false) {
    if (dek.length !== 32) {
      throw new Error(`PhiKeyManagedTransformer: DEK must be 32 bytes, got ${dek.length}`);
    }
    this.dek = Buffer.from(dek); // defensive copy
    this.deterministic = deterministic;
  }

  // ── Encrypt (to DB) ──────────────────────────────────────────────────────────

  to(value: string | null | undefined): string | null {
    if (value == null) return null;

    const version = Buffer.alloc(1, VERSION_BYTE);

    if (this.deterministic) {
      // Deterministic mode: IV = HMAC-SHA256(DEK, plaintext)[0..12)
      const iv = createHmac('sha256', this.dek)
        .update(value, 'utf8')
        .digest()
        .subarray(0, IV_LEN);

      const cipher = createCipheriv('aes-256-gcm', this.dek, iv);
      const ct = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();

      return Buffer.concat([version, iv, tag, ct]).toString('base64');
    }

    // Randomised mode: random salt and IV
    const salt = randomBytes(SALT_LEN);
    const iv = randomBytes(IV_LEN);

    const cipher = createCipheriv('aes-256-gcm', this.dek, iv);
    const ct = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([version, salt, iv, tag, ct]).toString('base64');
  }

  // ── Decrypt (from DB) ────────────────────────────────────────────────────────

  from(value: string | null | undefined): string | null {
    if (value == null) return null;

    try {
      const buf = Buffer.from(value, 'base64');

      // Version byte
      const version = buf[0];
      if (version !== VERSION_BYTE) {
        return null; // unsupported version
      }

      if (this.deterministic) {
        // Layout: version(1) | iv(12) | tag(16) | ct
        const iv = buf.subarray(1, 1 + IV_LEN);
        const tag = buf.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
        const ct = buf.subarray(1 + IV_LEN + TAG_LEN);

        const decipher = createDecipheriv('aes-256-gcm', this.dek, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
      }

      // Randomised mode: version(1) | salt(16) | iv(12) | tag(16) | ct
      const salt = buf.subarray(1, 1 + SALT_LEN);
      const iv = buf.subarray(1 + SALT_LEN, 1 + SALT_LEN + IV_LEN);
      const tag = buf.subarray(1 + SALT_LEN + IV_LEN, 1 + SALT_LEN + IV_LEN + TAG_LEN);
      const ct = buf.subarray(1 + SALT_LEN + IV_LEN + TAG_LEN);

      const decipher = createDecipheriv('aes-256-gcm', this.dek, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }
}
