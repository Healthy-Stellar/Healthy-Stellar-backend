import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
  algorithm: string;
}

export interface EncryptionContext {
  dataType: 'PHI' | 'PII' | 'MEDICAL_RECORD' | 'PRESCRIPTION' | 'LAB_RESULT';
  userId?: string;
  patientId?: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_LENGTH = 32; // 256 bits
  private readonly IV_LENGTH = 16;
  private readonly AUTH_TAG_LENGTH = 16;
  private readonly SALT_LENGTH = 64;
  private readonly KEY_VERSION = '1';

  private encryptionKey: Buffer;
  private derivedKeys: Map<string, Buffer> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeKeys();
  }

  private initializeKeys(): void {
    const masterKey = this.configService.get<string>('ENCRYPTION_MASTER_KEY');
    if (!masterKey || masterKey.length < 32) {
      throw new Error('ENCRYPTION_MASTER_KEY must be at least 32 characters');
    }
    const salt = this.configService.get<string>('ENCRYPTION_SALT', 'hipaa-compliance-salt-2024');
    this.encryptionKey = crypto.scryptSync(masterKey, salt, this.KEY_LENGTH);
    this.logger.log('Encryption keys initialized successfully');
  }

  /**
   * Encrypt Protected Health Information (PHI) - HIPAA compliant AES-256-GCM
   */
  encrypt(plaintext: string, context?: EncryptionContext): EncryptedData {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const key = this.getContextKey(context);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    if (context) {
      const aad = Buffer.from(JSON.stringify(context));
      cipher.setAAD(aad);
    }

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion: this.KEY_VERSION,
      algorithm: this.ALGORITHM,
    };
  }

  /**
   * Decrypt Protected Health Information - validates integrity via auth tag
   */
  decrypt(encryptedData: EncryptedData, context?: EncryptionContext): string {
    const { ciphertext, iv, authTag, keyVersion } = encryptedData;

    if (keyVersion !== this.KEY_VERSION) {
      throw new Error(`Unsupported key version: ${keyVersion}`);
    }

    const key = this.getContextKey(context);
    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, Buffer.from(iv, 'base64'));

    decipher.setAuthTag(Buffer.from(authTag, 'base64'));

    if (context) {
      const aad = Buffer.from(JSON.stringify(context));
      decipher.setAAD(aad);
    }

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Hash sensitive identifiers for audit logs (one-way, HIPAA safe)
   */
  hashIdentifier(value: string, salt?: string): string {
    const effectiveSalt = salt || this.configService.get<string>('HASH_SALT', 'audit-hash-salt');
    return crypto.createHmac('sha256', effectiveSalt).update(value).digest('hex');
  }

  /**
   * Generate secure token for medical device authentication
   */
  generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Derive a key specific to data context for additional isolation
   */
  private getContextKey(context?: EncryptionContext): Buffer {
    if (!context) return this.encryptionKey;

    const cacheKey = `${context.dataType}`;
    if (this.derivedKeys.has(cacheKey)) {
      return this.derivedKeys.get(cacheKey);
    }

    const derived = crypto.hkdfSync(
      'sha256',
      this.encryptionKey,
      Buffer.from(context.dataType),
      Buffer.from('healthcare-data-key'),
      this.KEY_LENGTH,
    );
    const derivedBuffer = Buffer.from(derived);
    this.derivedKeys.set(cacheKey, derivedBuffer);
    return derivedBuffer;
  }

  /**
   * Encrypt entire object's sensitive fields in place
   */
  encryptObject<T extends Record<string, unknown>>(
    obj: T,
    sensitiveFields: (keyof T)[],
    context?: EncryptionContext,
  ): T & { _encrypted: (keyof T)[] } {
    const result = { ...obj } as T & { _encrypted: (keyof T)[] };
    result._encrypted = [];

    for (const field of sensitiveFields) {
      if (obj[field] !== null && obj[field] !== undefined) {
        const value = String(obj[field]);
        result[field] = this.encrypt(value, context) as T[keyof T];
        result._encrypted.push(field);
      }
    }

    return result;
  }

  /**
   * Decrypt object fields that were encrypted
   */
  decryptObject<T extends Record<string, unknown>>(
    obj: T & { _encrypted?: (keyof T)[] },
    context?: EncryptionContext,
  ): T {
    const result = { ...obj } as T;
    const encryptedFields = obj._encrypted || [];

    for (const field of encryptedFields) {
      if (obj[field]) {
        result[field] = this.decrypt(obj[field] as unknown as EncryptedData, context) as T[keyof T];
      }
    }

    delete (result as Record<string, unknown>)._encrypted;
    return result;
  }

  /**
   * Generate a HIPAA-compliant data key for field-level encryption
   */
  generateDataKey(): { plaintext: Buffer; encrypted: string } {
    const plaintext = crypto.randomBytes(this.KEY_LENGTH);
    const { ciphertext, iv, authTag } = this.encrypt(plaintext.toString('base64'));
    return {
      plaintext,
      encrypted: JSON.stringify({ ciphertext, iv, authTag }),
    };
  }

  /**
   * Create an HMAC signature for data integrity verification
   */
  createIntegritySignature(data: string): string {
    return crypto.createHmac('sha512', this.encryptionKey).update(data).digest('hex');
  }

  /**
   * Verify data integrity signature
   */
  verifyIntegritySignature(data: string, signature: string): boolean {
    const expected = this.createIntegritySignature(data);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}
