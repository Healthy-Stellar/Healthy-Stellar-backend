import { Inject, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { KeyManagementError } from '../errors';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';
import { KEY_STORE, KeyStore } from '../../key-management/interfaces/key-store.interface';
import { KeyNotFoundException } from '../../key-management/exceptions/key-management.exceptions';
import { DekWrapper } from './dek-wrapper.interface';

const KEK_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEK_KEY_PREFIX = 'encryption-kek:patient:';
const MAX_CACHED_KEKS = 1000;

/**
 * Persistent Key Management Service
 *
 * Wraps/unwraps per-record DEKs with patient-specific KEKs that are persisted
 * through the key-management KeyStore (database, encrypted at rest, or AWS
 * KMS). A KEK is created on first use for a patient and survives restarts, so
 * records encrypted before a restart remain decryptable.
 *
 * Wire format of a wrapped DEK is identical to the in-memory implementation:
 * IV (12 bytes) + encrypted DEK + auth tag (16 bytes).
 */
@Injectable()
export class PersistentKeyManagementService implements DekWrapper {
  private readonly logger = new Logger(PersistentKeyManagementService.name);
  private readonly currentDekVersion = 'v1';

  /** Small LRU of decrypted KEKs to avoid a store round-trip (and scrypt) per record. */
  private readonly cache = new Map<string, Buffer>();
  /** De-duplicates concurrent first-use loads/creations for the same patient. */
  private readonly inflight = new Map<string, Promise<Buffer>>();

  constructor(
    @Inject(KEY_STORE) private readonly keyStore: KeyStore,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async wrapDek(dek: Buffer, patientId: string): Promise<Buffer> {
    return this.circuitBreaker.execute('kms', async () => {
      const kek = await this.resolveKek(patientId, true);
      try {
        const iv = crypto.randomBytes(IV_BYTES);
        const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
        const encryptedDek = Buffer.concat([cipher.update(dek), cipher.final()]);
        return Buffer.concat([iv, encryptedDek, cipher.getAuthTag()]);
      } catch (error) {
        throw new KeyManagementError(
          `Failed to wrap DEK for patient ${patientId}: ${error.message}`,
        );
      }
    });
  }

  async unwrapDek(encryptedDek: Buffer, patientId: string): Promise<Buffer> {
    return this.circuitBreaker.execute('kms', async () => {
      // Never create a KEK on decrypt: a missing KEK means the data is unrecoverable.
      const kek = await this.resolveKek(patientId, false);
      try {
        const iv = encryptedDek.subarray(0, IV_BYTES);
        const authTag = encryptedDek.subarray(encryptedDek.length - TAG_BYTES);
        const ciphertext = encryptedDek.subarray(IV_BYTES, encryptedDek.length - TAG_BYTES);
        const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      } catch (error) {
        throw new KeyManagementError(
          `Failed to unwrap DEK for patient ${patientId}: ${error.message}`,
        );
      }
    });
  }

  getDekVersion(_patientId: string): string {
    return this.currentDekVersion;
  }

  private async resolveKek(patientId: string, createIfMissing: boolean): Promise<Buffer> {
    if (!patientId || typeof patientId !== 'string') {
      throw new KeyManagementError('patientId is required for KEK selection');
    }

    const cached = this.cache.get(patientId);
    if (cached) {
      // refresh LRU position
      this.cache.delete(patientId);
      this.cache.set(patientId, cached);
      return cached;
    }

    const key = `${createIfMissing ? 'c' : 'r'}:${patientId}`;
    let pending = this.inflight.get(key);
    if (!pending) {
      pending = this.loadKek(patientId, createIfMissing).finally(() => this.inflight.delete(key));
      this.inflight.set(key, pending);
    }

    const kek = await pending;
    this.remember(patientId, kek);
    return kek;
  }

  private async loadKek(patientId: string, createIfMissing: boolean): Promise<Buffer> {
    const keyId = KEK_KEY_PREFIX + patientId;

    const existing = await this.tryRetrieve(keyId);
    if (existing) return existing;

    if (!createIfMissing) {
      throw new KeyManagementError(`KEK not found for patient ${patientId}.`);
    }

    await this.keyStore.storeKey(keyId, crypto.randomBytes(KEK_BYTES).toString('base64'));
    this.logger.log(`Created KEK for patient ${patientId}`);

    // Read back what was persisted so every caller converges on the stored KEK.
    const stored = await this.tryRetrieve(keyId);
    if (!stored) {
      throw new KeyManagementError(`KEK for patient ${patientId} could not be persisted.`);
    }
    return stored;
  }

  private async tryRetrieve(keyId: string): Promise<Buffer | null> {
    let encoded: string;
    try {
      encoded = await this.keyStore.retrieveKey(keyId);
    } catch (error) {
      if (error instanceof KeyNotFoundException) return null;
      throw new KeyManagementError(`Failed to load KEK: ${error.message}`);
    }

    const kek = Buffer.from(encoded, 'base64');
    if (kek.length !== KEK_BYTES) {
      throw new KeyManagementError('Stored KEK is corrupt (unexpected length)');
    }
    return kek;
  }

  private remember(patientId: string, kek: Buffer): void {
    this.cache.set(patientId, kek);
    if (this.cache.size > MAX_CACHED_KEKS) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
  }
}
