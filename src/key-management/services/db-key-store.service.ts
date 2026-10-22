import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { KeyStore, StoredKey } from '../interfaces/key-store.interface';
import { KeyManagementException, KeyNotFoundException } from '../exceptions/key-management.exceptions';
import { PatientDekEntity } from '../entities/patient-dek.entity';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const TAG_BYTES = 16;

/**
 * Database-backed KeyStore adapter.
 * Secret keys are encrypted at rest using AES-256-GCM with a key derived
 * from the KEY_STORE_MASTER_KEY env variable via scrypt.
 *
 * Suitable for local development and test environments.
 * NOT recommended for production — use AwsKmsKeyStore instead.
 */
@Injectable()
export class DbKeyStore implements KeyStore {
  private readonly logger = new Logger(DbKeyStore.name);
  private readonly masterKey: Buffer;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(PatientDekEntity)
    private readonly dekRepo: Repository<PatientDekEntity>,
  ) {
    const hex = this.config.get<string>('KEY_STORE_MASTER_KEY');
    if (!hex) {
      throw new KeyManagementException(
        'KEY_STORE_MASTER_KEY environment variable is required for DbKeyStore',
      );
    }
    this.masterKey = Buffer.from(hex, 'hex');
    if (this.masterKey.length !== KEY_BYTES) {
      throw new KeyManagementException(
        'KEY_STORE_MASTER_KEY must be 32 bytes (64 hex characters)',
      );
    }
  }

  async storeKey(keyId: string, secretKey: string): Promise<void> {
    const salt = randomBytes(SALT_BYTES);
    const iv = randomBytes(IV_BYTES);
    const dk = scryptSync(this.masterKey, salt, KEY_BYTES);
    const cipher = createCipheriv(ALGORITHM, dk, iv);
    const ciphertext = Buffer.concat([
      cipher.update(secretKey, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const payload = Buffer.concat([salt, iv, authTag, ciphertext]).toString('base64');

    await this.dekRepo.save({
      patientAddress: keyId,
      ciphertext: payload,
      iv: '',
      authTag: '',
      masterKeyVersion: 'db-key-store-v1',
    } as any);

    this.logger.log(`Key stored: ${keyId}`);
  }

  async retrieveKey(keyId: string): Promise<string> {
    const entity = await this.dekRepo.findOne({ where: { patientAddress: keyId } as any });
    if (!entity) {
      throw new KeyNotFoundException(keyId);
    }

    const buf = Buffer.from(entity.ciphertext, 'base64');
    const salt = buf.subarray(0, SALT_BYTES);
    const iv = buf.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES);
    const authTag = buf.subarray(SALT_BYTES + IV_BYTES, SALT_BYTES + IV_BYTES + TAG_BYTES);
    const ciphertext = buf.subarray(SALT_BYTES + IV_BYTES + TAG_BYTES);

    const dk = scryptSync(this.masterKey, salt, KEY_BYTES);
    const decipher = createDecipheriv(ALGORITHM, dk, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  async deleteKey(keyId: string): Promise<void> {
    const entity = await this.dekRepo.findOne({ where: { patientAddress: keyId } as any });
    if (entity) {
      await this.dekRepo.remove(entity);
      this.logger.log(`Key deleted: ${keyId}`);
    }
  }

  async listKeys(): Promise<StoredKey[]> {
    const entities = await this.dekRepo.find();
    return entities.map((e) => ({
      keyId: e.patientAddress,
      ciphertext: e.ciphertext.substring(0, 40) + '...', // truncated for listing
      keyVersion: e.masterKeyVersion,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async rotateWrappingKey(): Promise<{ rewrappedCount: number }> {
    const entities = await this.dekRepo.find();
    let count = 0;

    for (const entity of entities) {
      try {
        const secret = await this.retrieveKey(entity.patientAddress);
        await this.storeKey(entity.patientAddress, secret);
        count++;
      } catch (err) {
        this.logger.warn(`Failed to re-wrap key ${entity.patientAddress}: ${err.message}`);
      }
    }

    this.logger.log(`Key rotation complete: ${count} keys re-wrapped`);
    return { rewrappedCount: count };
  }
}
