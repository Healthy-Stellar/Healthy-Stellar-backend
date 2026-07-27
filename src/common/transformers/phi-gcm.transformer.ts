import { ValueTransformer } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;

/**
 * Randomised AES-256-GCM transformer for free-text PHI fields (notes, description).
 * Each write produces a unique ciphertext — NOT suitable for indexed equality search.
 * Reads the ENCRYPTION_KEY env var; throws at construction if absent.
 */
export class PhiGcmTransformer implements ValueTransformer {
  private readonly key: string;

  constructor() {
    this.key = process.env.ENCRYPTION_KEY;
    if (!this.key) throw new Error('ENCRYPTION_KEY must be set');
  }

  to(value: string | null | undefined): string | null {
    if (value == null) return null;
    const salt = randomBytes(SALT_LEN);
    const iv = randomBytes(IV_LEN);
    const dk = scryptSync(this.key, salt, 32);
    const cipher = createCipheriv('aes-256-gcm', dk, iv);
    const ct = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([salt, iv, tag, ct]).toString('base64');
  }

  from(value: string | null | undefined): string | null {
    if (value == null) return null;
    try {
      const buf = Buffer.from(value, 'base64');
      const salt = buf.subarray(0, SALT_LEN);
      const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN);
      const tag = buf.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
      const ct = buf.subarray(SALT_LEN + IV_LEN + TAG_LEN);
      const dk = scryptSync(this.key, salt, 32);
      const decipher = createDecipheriv('aes-256-gcm', dk, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }
}
