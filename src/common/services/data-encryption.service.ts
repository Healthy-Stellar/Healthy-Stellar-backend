import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto';

const CIPHERTEXT_PREFIX = 'v2:';
const HKDF_SALT = 'healthy-stellar/data-encryption/v2';
const HKDF_INFO = 'aes-256-gcm';

@Injectable()
export class DataEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 12;
  private readonly tagLength = 16;
  private readonly legacySaltLength = 16;
  private readonly legacyIvLength = 16;
  private readonly legacyTagLength = 16;
  private readonly encryptionKey: string;
  private readonly dataKey: Buffer;

  constructor(private configService: ConfigService) {
    this.encryptionKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY must be set in environment variables');
    }

    this.dataKey = Buffer.from(
      hkdfSync(
        'sha256',
        Buffer.from(this.encryptionKey),
        HKDF_SALT,
        HKDF_INFO,
        this.keyLength,
      ),
    );
  }

  encrypt(plainText: string): string {
    if (!plainText) return null;

    try {
      const iv = randomBytes(this.ivLength);
      const cipher = createCipheriv(this.algorithm, this.dataKey, iv);

      const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
      const result = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
      return `${CIPHERTEXT_PREFIX}${result.toString('base64')}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  decrypt(encryptedData: string): string {
    if (!encryptedData) return null;

    try {
      if (encryptedData.startsWith(CIPHERTEXT_PREFIX)) {
        return this.decryptCurrent(encryptedData.slice(CIPHERTEXT_PREFIX.length));
      }
      return this.decryptLegacy(encryptedData);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  hash(data: string, salt?: string): string {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : randomBytes(this.legacySaltLength);
    const hash = scryptSync(data, saltBuffer, 64);
    return `${saltBuffer.toString('hex')}:${hash.toString('hex')}`;
  }

  verifyHash(data: string, hashedData: string): boolean {
    const [salt, hash] = hashedData.split(':');
    if (!salt || !hash) return false;

    const expected = Buffer.from(hash, 'hex');
    if (expected.length === 0) return false;

    const actual = scryptSync(data, Buffer.from(salt, 'hex'), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (!data || data.length <= visibleChars) {
      return '****';
    }
    return data.substring(0, visibleChars) + '*'.repeat(data.length - visibleChars);
  }

  private decryptCurrent(payload: string): string {
    const data = Buffer.from(payload, 'base64');
    const iv = data.subarray(0, this.ivLength);
    const tag = data.subarray(this.ivLength, this.ivLength + this.tagLength);
    const encrypted = data.subarray(this.ivLength + this.tagLength);

    const decipher = createDecipheriv(this.algorithm, this.dataKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  private decryptLegacy(payload: string): string {
    const data = Buffer.from(payload, 'base64');
    const salt = data.subarray(0, this.legacySaltLength);
    const iv = data.subarray(this.legacySaltLength, this.legacySaltLength + this.legacyIvLength);
    const tag = data.subarray(
      this.legacySaltLength + this.legacyIvLength,
      this.legacySaltLength + this.legacyIvLength + this.legacyTagLength,
    );
    const encrypted = data.subarray(
      this.legacySaltLength + this.legacyIvLength + this.legacyTagLength,
    );

    const key = scryptSync(this.encryptionKey, salt, this.keyLength);
    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
