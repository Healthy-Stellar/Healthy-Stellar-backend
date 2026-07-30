import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

import {
  EncryptedKey,
  DataKeyResult,
  KeyManagementService,
  KeyManagementStrategy,
} from '../interfaces/key-management.interface';

import { PatientDekEntity } from '../entities/patient-dek.entity';
import { KeyRotationLog } from '../entities/key-rotation-log.entity';
import { KeyManagementException, KeyRotationException } from '../exceptions/key-management.exceptions';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

@Injectable()
export class EnvelopeKeyManagementService implements KeyManagementService, KeyManagementStrategy, OnModuleInit {
  private readonly logger = new Logger(EnvelopeKeyManagementService.name);

  /** All loaded master keys keyed by version — supports dual-key during rotation */
  private readonly masterKeys = new Map<string, Buffer>();
  private activeMasterKeyVersion: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(PatientDekEntity)
    private readonly dekRepo: Repository<PatientDekEntity>,
    @InjectRepository(KeyRotationLog)
    private readonly rotationLogRepo: Repository<KeyRotationLog>,
  ) {}

  onModuleInit(): void {

    const env = this.config.get<string>('NODE_ENV', 'development');
    if (env === 'production') {
      throw new KeyManagementException(
        'LocalKeyManagementStrategy (EnvelopeKeyManagementService) must not be used in production. ' +
          'Set KEY_MANAGEMENT_PROVIDER=aws or KEY_MANAGEMENT_PROVIDER=gcp.',
      );
    }
    this.loadMasterKeys();

  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async generateDEK(patientAddress: string): Promise<DataKeyResult> {
    const plainKey = randomBytes(KEY_BYTES);
    const encryptedKey = this.encryptWithActiveKey(plainKey);
    await this.persistDek(patientAddress, encryptedKey);
    return { encryptedKey, plainKey };
  }

  async decryptDEK(encryptedKey: EncryptedKey): Promise<Buffer> {
    return this.decryptWithKey(encryptedKey);
  }

  /**
   * Three-phase key rotation:
   *   Phase 1 — Operator sets MASTER_KEY_NEW + MASTER_KEY_NEW_VERSION in env.
   *   Phase 2 — Call rotateMasterKey(): re-encrypts all DEKs with the new key.
   *   Phase 3 — Operator removes MASTER_KEY_PREV / MASTER_KEY_PREV_VERSION from env.
   *
   * During phase 2 the service holds both keys in memory so any in-flight
   * decryption against the old version continues to work.
   */
  async rotateMasterKey(operatorId: string): Promise<{ reencryptedCount: number }> {
    const newKeyHex = this.config.get<string>('MASTER_KEY_NEW');
    const newVersion = this.config.get<string>('MASTER_KEY_NEW_VERSION');

    if (!newKeyHex || !newVersion) {
      throw new KeyRotationException('all', 'MASTER_KEY_NEW / MASTER_KEY_NEW_VERSION not set');
    }

    const newMasterKey = Buffer.from(newKeyHex, 'hex');
    if (newMasterKey.length !== KEY_BYTES) {
      throw new KeyRotationException('all', 'MASTER_KEY_NEW must be 32 bytes (64 hex chars)');
    }

    const oldVersion = this.activeMasterKeyVersion;

    // Register new key in memory immediately so concurrent decryptions keep working
    this.masterKeys.set(newVersion, newMasterKey);

    const logEntry = this.rotationLogRepo.create({
      oldKeyVersion: oldVersion,
      newKeyVersion: newVersion,
      operatorId,
      phase: 'started',
      reencryptedCount: 0,
    });
    await this.rotationLogRepo.save(logEntry);

    const deks = await this.dekRepo.find();
    this.logger.log(`Starting master key rotation for ${deks.length} DEKs (${oldVersion} → ${newVersion})`);

    let reencryptedCount = 0;
    try {
      for (const dek of deks) {
        const encryptedKey: EncryptedKey = {
          ciphertext: Buffer.from(dek.ciphertext, 'hex'),
          iv: Buffer.from(dek.iv, 'hex'),
          authTag: Buffer.from(dek.authTag, 'hex'),
          masterKeyVersion: dek.masterKeyVersion,
        };

        const plainDek = await this.decryptDEK(encryptedKey);
        const reEncrypted = this.encryptWithKey(plainDek, newMasterKey, newVersion);
        plainDek.fill(0);

        await this.persistDek(dek.patientAddress, reEncrypted);
        reencryptedCount++;
      }
    } catch (err) {
      await this.rotationLogRepo.update(logEntry.id, {
        phase: 'failed',
        errorMessage: err.message,
        completedAt: new Date(),
        reencryptedCount,
      });
      throw new KeyRotationException('batch', err.message);
    }

    // Promote new key as active; keep old key available for any in-flight requests
    this.activeMasterKeyVersion = newVersion;

    await this.rotationLogRepo.update(logEntry.id, {
      phase: 'completed',
      reencryptedCount,
      completedAt: new Date(),
    });

    this.logger.log(`Master key rotation complete — active version: ${newVersion}, re-encrypted: ${reencryptedCount}`);
    return { reencryptedCount };
  }

  async getRotationStatus(): Promise<KeyRotationLog[]> {
    return this.rotationLogRepo.find({ order: { startedAt: 'DESC' }, take: 20 });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Loads the active master key plus any previous key still needed during a
   * rotation window (MASTER_KEY_PREV / MASTER_KEY_PREV_VERSION).
   */
  private loadMasterKeys(): void {
    const hex = this.config.get<string>('MASTER_KEY');
    const version = this.config.get<string>('MASTER_KEY_VERSION', 'v1');

    if (!hex) throw new KeyManagementException('MASTER_KEY environment variable is required');

    const key = Buffer.from(hex, 'hex');
    if (key.length !== KEY_BYTES) throw new KeyManagementException('MASTER_KEY must be 32 bytes (64 hex chars)');

    this.masterKeys.set(version, key);
    this.activeMasterKeyVersion = version;

    // Load previous key if present (dual-key support during rotation window)
    const prevHex = this.config.get<string>('MASTER_KEY_PREV');
    const prevVersion = this.config.get<string>('MASTER_KEY_PREV_VERSION');
    if (prevHex && prevVersion) {
      const prevKey = Buffer.from(prevHex, 'hex');
      if (prevKey.length === KEY_BYTES) {
        this.masterKeys.set(prevVersion, prevKey);
        this.logger.log(`Loaded previous master key version ${prevVersion} for rotation window`);
      }
    }
  }

  private encryptWithActiveKey(plaintext: Buffer): EncryptedKey {
    const key = this.masterKeys.get(this.activeMasterKeyVersion)!;
    return this.encryptWithKey(plaintext, key, this.activeMasterKeyVersion);
  }

  private encryptWithKey(plaintext: Buffer, key: Buffer, version: string): EncryptedKey {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { ciphertext, iv, authTag, masterKeyVersion: version };
  }

  private decryptWithKey(encryptedKey: EncryptedKey): Buffer {
    const key = this.masterKeys.get(encryptedKey.masterKeyVersion);
    if (!key) {
      throw new KeyManagementException(`Unknown master key version: ${encryptedKey.masterKeyVersion}`);
    }
    try {
      const decipher = createDecipheriv(ALGORITHM, key, encryptedKey.iv);
      decipher.setAuthTag(encryptedKey.authTag);
      return Buffer.concat([decipher.update(encryptedKey.ciphertext), decipher.final()]);
    } catch {
      throw new KeyManagementException('DEK decryption failed — possible tampering or wrong master key');
    }
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
