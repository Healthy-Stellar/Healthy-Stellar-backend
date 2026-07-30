import { ValueTransformer } from 'typeorm';
import { createCipheriv, createDecipheriv, createHmac, scryptSync } from 'crypto';

/**
 * Deterministic AES-256-SIV-style transformer for searchable PHI fields
 * (diagnosis codes, tags, recordType overrides).
 *
 * The synthetic IV is derived as HMAC-SHA256(ENCRYPTION_KEY, plaintext) truncated
 * to 12 bytes, making identical plaintexts produce identical ciphertexts so
 * equality-based index lookups work. There is NO random salt — the key is derived
 * directly from ENCRYPTION_KEY via scrypt with a fixed domain-separation salt.
 *
 * Trade-off: deterministic encryption leaks whether two rows share the same value.
 * Use only for low-cardinality coded fields (ICD-10 codes, enum-like tags), never
 * for free-text.
 */
export class PhiDeterministicTransformer implements ValueTransformer {
  private readonly dk: Buffer;

  constructor() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) throw new Error('ENCRYPTION_KEY must be set');
    // Fixed domain-separation salt — intentional for determinism
    this.dk = scryptSync(key, 'phi-deterministic-v1', 32);
  }

  to(value: string | null | undefined): string | null {
    if (value == null) return null;
    // Synthetic IV = first 12 bytes of HMAC-SHA256(dk, plaintext)
    const iv = createHmac('sha256', this.dk).update(value, 'utf8').digest().subarray(0, 12);
    const cipher = createCipheriv('aes-256-gcm', this.dk, iv);
    const ct = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Layout: iv(12) | tag(16) | ct
    return Buffer.concat([iv, tag, ct]).toString('base64');
  }

  from(value: string | null | undefined): string | null {
    if (value == null) return null;
    try {
      const buf = Buffer.from(value, 'base64');
      const iv = buf.subarray(0, 12);
      const tag = buf.subarray(12, 28);
      const ct = buf.subarray(28);
      const decipher = createDecipheriv('aes-256-gcm', this.dk, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }
}
