import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export class EncryptionUtil {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly SALT_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;

  static async encrypt(plainText: string, encryptionKey: string): Promise<string> {
    try {
      const salt = randomBytes(this.SALT_LENGTH);
      const iv = randomBytes(this.IV_LENGTH);

      const key = (await scryptAsync(encryptionKey, salt, this.KEY_LENGTH)) as Buffer;

      const cipher = createCipheriv(this.ALGORITHM, key, iv);

      const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);

      const tag = cipher.getAuthTag();

      const result = Buffer.concat([salt, iv, tag, encrypted]);
      return result.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  static async decrypt(encryptedData: string, encryptionKey: string): Promise<string> {
    try {
      const data = Buffer.from(encryptedData, 'base64');

      const salt = data.subarray(0, this.SALT_LENGTH);
      const iv = data.subarray(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const tag = data.subarray(
        this.SALT_LENGTH + this.IV_LENGTH,
        this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH,
      );
      const encrypted = data.subarray(this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);

      const key = (await scryptAsync(encryptionKey, salt, this.KEY_LENGTH)) as Buffer;

      const decipher = createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  static async hash(data: string, salt?: string): Promise<string> {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : randomBytes(this.SALT_LENGTH);
    const hash = (await scryptAsync(data, saltBuffer, 64)) as Buffer;
    return `${saltBuffer.toString('hex')}:${hash.toString('hex')}`;
  }

  static async verifyHash(data: string, hashedData: string): Promise<boolean> {
    const [salt, hash] = hashedData.split(':');
    const hashToVerify = (await scryptAsync(data, Buffer.from(salt, 'hex'), 64)) as Buffer;
    return hash === hashToVerify.toString('hex');
  }

  static generateKey(): string {
    return randomBytes(this.KEY_LENGTH).toString('hex');
  }

  static maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (!data || data.length <= visibleChars) {
      return '****';
    }
    return data.substring(0, visibleChars) + '*'.repeat(data.length - visibleChars);
  }
}
