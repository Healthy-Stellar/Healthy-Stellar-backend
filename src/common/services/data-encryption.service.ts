import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

@Injectable()
export class DataEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly saltLength = 16;
  private readonly tagLength = 16;
  private readonly encryptionKey: string;

  constructor(private configService: ConfigService) {
    this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY must be set in environment variables');
    }
  }

  encrypt(plainText: string): string {
    if (!plainText) return null;

    try {
      const salt = randomBytes(this.saltLength);
      const iv = randomBytes(this.ivLength);

      const key = scryptSync(this.encryptionKey, salt, this.keyLength);

      const cipher = createCipheriv(this.algorithm, key, iv);

      const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);

      const tag = cipher.getAuthTag();

      const result = Buffer.concat([salt, iv, tag, encrypted]);
      return result.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  decrypt(encryptedData: string): string {
    if (!encryptedData) return null;

    try {
      const data = Buffer.from(encryptedData, 'base64');

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
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  hash(data: string, salt?: string): string {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : randomBytes(this.saltLength);
    const hash = scryptSync(data, saltBuffer, 64);
    return `${saltBuffer.toString('hex')}:${hash.toString('hex')}`;
  }

  verifyHash(data: string, hashedData: string): boolean {
    const [salt, hash] = hashedData.split(':');
    const hashToVerify = scryptSync(data, Buffer.from(salt, 'hex'), 64);
    return hash === hashToVerify.toString('hex');
  }

  maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (!data || data.length <= visibleChars) {
      return '****';
    }
    return data.substring(0, visibleChars) + '*'.repeat(data.length - visibleChars);
  }
}
