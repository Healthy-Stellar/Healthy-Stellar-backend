import { ValueTransformer } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

export class EncryptionTransformer implements ValueTransformer {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly saltLength = 16;
  private readonly tagLength = 16;
  private readonly encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY;
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY must be set in environment variables');
    }
  }

  to(value: string): string {
    if (!value) return null;

    try {
      const salt = randomBytes(this.saltLength);
      const iv = randomBytes(this.ivLength);

      const key = scryptSync(this.encryptionKey, salt, this.keyLength);
      const cipher = createCipheriv(this.algorithm, key, iv);

      const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);

      const tag = cipher.getAuthTag();
      const result = Buffer.concat([salt, iv, tag, encrypted]);
      return result.toString('base64');
    } catch (error) {
      console.error('[ENCRYPTION] Encryption failed:', error.message);
      return null;
    }
  }

  from(value: string): string {
    if (!value) return null;

    try {
      const data = Buffer.from(value, 'base64');

      const salt = data.subarray(0, this.saltLength);
      const iv = data.subarray(this.saltLength, this.saltLength + this.ivLength);
      const tag = data.subarray(
        this.saltLength + this.ivLength,
        this.saltLength + this.ivLength + this.tagLength,
      );
      const encrypted = data.subarray(this.saltLength + this.ivLength + this.tagLength);

      const key = scryptSync(this.encryptionKey, salt, this.keyLength);
      const decipher = createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      console.error('[ENCRYPTION] Decryption failed:', error.message);
      return null;
    }
  }
}
