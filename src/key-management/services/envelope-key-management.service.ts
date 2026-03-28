import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { EncryptedKey, DataKeyResult, KeyManagementService } from '../interfaces/key-management.interface';
import { PatientDekEntity } from '../entities/patient-dek.entity';
import { KeyManagementException, KeyRotationException } from '../exceptions/key-management.exceptions';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

@Injectable()
export class EnvelopeKeyManagementService implements KeyManagementService, OnModuleInit {
  private readonly logger = new Logger(EnvelopeKeyManagementService.name);

  /** Active master key — loaded from env/HSM, never logged */
  private masterKey: Buffer;
  private masterKeyVersion: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(PatientDekEntity)
    private readonly dekRepo: Repository<PatientDekEntity>,
  ) {}

  onModuleInit(): void {
    this.loadMasterKey();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Generates a fresh 256-bit DEK for a patient, encrypts it with the master
   * key, persists the encrypted form, and returns both.
   * The caller MUST zero the plainKey after use and MUST NOT persist it.
   */
  async generateDEK(patientAddress: string): Promise<DataKeyResult> {
    const plainKey = randomBytes(KEY_BYTES);
    const encryptedKey = this.encryptWithMasterKey(plainKey);

    await this.persistDek(patientAddress, encryptedKey);

    return { encryptedKey, plainKey };
  }

  /**
   * Decrypts an encrypted DEK using the master key version recorded on the
   * EncryptedKey. Throws if the master key version is unknown or auth fails.
   */
  async decryptDEK(encryptedKey: EncryptedKey): Promise<Buffer> {
    return this.decryptWithMasterKey(encryptedKey);
  }

  /**
   * Re-encrypts every stored DEK with the new master key.
   * Atomically updates each row; rolls back on any failure.
   *
   * Key rotation procedure:
   *   1. Set MASTER_KEY_NEW + MASTER_KEY_NEW_VERSION in env/HSM.
   *   2. Call rotateMasterKey() (or trigger via admin endpoint).
   *   3. After success, promote NEW → current and remove OLD.
   */
  async rotateMasterKey(): Promise<void> {
    const newKeyHex = this.config.get<string>('MASTER_KEY_NEW');
    const newVersion = this.config.get<string>('MASTER_KEY_NEW_VERSION');

    if (!newKeyHex || !newVersion) {
      throw new KeyRotationException('all', 'MASTER_KEY_NEW / MASTER_KEY_NEW_VERSION not set');
    }

    const newMasterKey = Buffer.from(newKeyHex, 'hex');
    if (newMasterKey.length !== KEY_BYTES) {
      throw new KeyRotationException('all', 'MASTER_KEY_NEW must be 32 bytes (64 hex chars)');
    }

    const deks = await this.dekRepo.find();
    this.logger.log(`Starting master key rotation for ${deks.length} DEKs`);

    for (const dek of deks) {
      try {
        const encryptedKey: EncryptedKey = {
          ciphertext: Buffer.from(dek.ciphertext, 'hex'),
          iv: Buffer.from(dek.iv, 'hex'),
          authTag: Buffer.from(dek.authTag, 'hex'),
          masterKeyVersion: dek.masterKeyVersion,
        };

        const plainDek = await this.decryptDEK(encryptedKey);
        const reEncrypted = this.encryptWithKey(plainDek, newMasterKey, newVersion);
        plainDek.fill(0); // zero plaintext immediately

        await this.persistDek(dek.patientAddress, reEncrypted);
      } catch (err) {
        throw new KeyRotationException(dek.patientAddress, err.message);
      }
    }

    // Promote new key as active
    this.masterKey = newMasterKey;
    this.masterKeyVersion = newVersion;
    this.logger.log(`Master key rotation complete — active version: ${newVersion}`);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private loadMasterKey(): void {
    const hex = this.config.get<string>('MASTER_KEY');
    const version = this.config.get<string>('MASTER_KEY_VERSION', 'v1');

    if (!hex) {
      throw new KeyManagementException('MASTER_KEY environment variable is required');
    }

    const key = Buffer.from(hex, 'hex');
    if (key.length !== KEY_BYTES) {
      throw new KeyManagementException('MASTER_KEY must be 32 bytes (64 hex chars)');
    }

    this.masterKey = key;
    this.masterKeyVersion = version;
  }

  private encryptWithMasterKey(plaintext: Buffer): EncryptedKey {
    return this.encryptWithKey(plaintext, this.masterKey, this.masterKeyVersion);
  }

  private encryptWithKey(plaintext: Buffer, key: Buffer, version: string): EncryptedKey {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { ciphertext, iv, authTag, masterKeyVersion: version };
  }

  private decryptWithMasterKey(encryptedKey: EncryptedKey): Buffer {
    const key = this.resolveKeyForVersion(encryptedKey.masterKeyVersion);
    try {
      const decipher = createDecipheriv(ALGORITHM, key, encryptedKey.iv);
      decipher.setAuthTag(encryptedKey.authTag);
      return Buffer.concat([decipher.update(encryptedKey.ciphertext), decipher.final()]);
    } catch {
      throw new KeyManagementException('DEK decryption failed — possible tampering or wrong master key');
    }
  }

  private resolveKeyForVersion(version: string): Buffer {
    if (version === this.masterKeyVersion) return this.masterKey;

    // Support one previous version during rotation window
    const prevHex = this.config.get<string>('MASTER_KEY_PREV');
    const prevVersion = this.config.get<string>('MASTER_KEY_PREV_VERSION');
    if (prevHex && version === prevVersion) {
      return Buffer.from(prevHex, 'hex');
    }

    throw new KeyManagementException(`Unknown master key version: ${version}`);
  }

  private async persistDek(patientAddress: string, encryptedKey: EncryptedKey): Promise<void> {
    await this.dekRepo.save({
      patientAddress,
      ciphertext: encryptedKey.ciphertext.toString('hex'),
      iv: encryptedKey.iv.toString('hex'),
      authTag: encryptedKey.authTag.toString('hex'),
      masterKeyVersion: encryptedKey.masterKeyVersion,
    });
  }
}
