import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
  EncryptCommand,
} from '@aws-sdk/client-kms';
import { KeyStore, StoredKey } from '../interfaces/key-store.interface';
import { KeyManagementException, KeyNotFoundException } from '../exceptions/key-management.exceptions';

/**
 * AWS KMS-backed KeyStore adapter.
 *
 * Secret keys are wrapped using KMS GenerateDataKey (envelope encryption).
 * The data key plaintext encrypts the secret key via AES-256-GCM, while the
 * encrypted data key is stored alongside the ciphertext in the database.
 *
 * Suitable for production environments where Stellar secret keys must be
 * protected by a Hardware Security Module.
 */
@Injectable()
export class AwsKmsKeyStore implements KeyStore {
  private readonly logger = new Logger(AwsKmsKeyStore.name);
  private readonly kmsClient: KMSClient;
  private readonly keyId: string;

  constructor(private readonly config: ConfigService) {
    this.keyId = this.config.getOrThrow<string>('AWS_KMS_KEY_ID');
    this.kmsClient = new KMSClient({
      region: this.config.get<string>('AWS_REGION', 'us-east-1'),
    });
    this.logger.log(`AwsKmsKeyStore initialised with KMS key ${this.keyId}`);
  }

  async storeKey(keyId: string, secretKey: string): Promise<void> {
    try {
      // Generate a data key from KMS
      const dataKeyResult = await this.kmsClient.send(
        new GenerateDataKeyCommand({
          KeyId: this.keyId,
          KeySpec: 'AES_256',
        }),
      );

      const plaintextDek = Buffer.from(dataKeyResult.Plaintext!);
      const encryptedDek = Buffer.from(dataKeyResult.CiphertextBlob!);

      // Encrypt the secret key with the plaintext DEK using AES-256-GCM
      const { randomBytes, createCipheriv } = await import('crypto');
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', plaintextDek, iv);
      const ciphertext = Buffer.concat([
        cipher.update(secretKey, 'utf8'),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();

      // Clear the plaintext DEK from memory
      plaintextDek.fill(0);

      // Store: encryptedDek(4-byte-length + var) || iv || authTag || ciphertext
      const dekLen = Buffer.alloc(4);
      dekLen.writeUInt32BE(encryptedDek.length);
      const payload = Buffer.concat([
        dekLen,
        encryptedDek,
        iv,
        authTag,
        ciphertext,
      ]).toString('base64');

      // Persist using the DEK repo
      const { InjectRepository } = await import('@nestjs/typeorm');
      // Use patient_deks table to store key material
      await this.persist(keyId, payload);
    } catch (err) {
      throw new KeyManagementException(`AWS KMS storeKey failed: ${err.message}`);
    }
  }

  async retrieveKey(keyId: string): Promise<string> {
    const raw = await this.loadRaw(keyId);
    if (!raw) {
      throw new KeyNotFoundException(keyId);
    }

    try {
      const buf = Buffer.from(raw, 'base64');
      let offset = 0;
      const dekLen = buf.readUInt32BE(offset);
      offset += 4;
      const encryptedDek = buf.subarray(offset, offset + dekLen);
      offset += dekLen;
      const iv = buf.subarray(offset, offset + 12);
      offset += 12;
      const authTag = buf.subarray(offset, offset + 16);
      offset += 16;
      const ciphertext = buf.subarray(offset);

      // Decrypt the DEK via KMS
      const decryptResult = await this.kmsClient.send(
        new DecryptCommand({
          CiphertextBlob: encryptedDek,
        }),
      );

      const plaintextDek = Buffer.from(decryptResult.Plaintext!);

      // Decrypt the secret key
      const { createDecipheriv } = await import('crypto');
      const decipher = createDecipheriv('aes-256-gcm', plaintextDek, iv);
      decipher.setAuthTag(authTag);
      const secret = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');

      // Clear DEK from memory
      plaintextDek.fill(0);

      return secret;
    } catch (err) {
      throw new KeyManagementException(`AWS KMS retrieveKey failed: ${err.message}`);
    }
  }

  async deleteKey(keyId: string): Promise<void> {
    // This would need a dedicated deletion table; for now a no-op log
    this.logger.warn(`deleteKey(${keyId}) — key deletion from KMS is a manual operation`);
  }

  async listKeys(): Promise<StoredKey[]> {
    // In a production KMS scenario, listing requires a separate index table
    this.logger.warn('listKeys() — not fully implemented for KMS-backed store; returns empty');
    return [];
  }

  async rotateWrappingKey(): Promise<{ rewrappedCount: number }> {
    // KMS automatic key rotation handles this; the CMK ARN stays the same
    this.logger.log(
      'rotateWrappingKey() — KMS automatic key rotation handles CMK rotation; ' +
        'existing DEKs remain decryptable under the same CMK ARN',
    );
    return { rewrappedCount: 0 };
  }

  // ─── Private helpers ────────────────────────────────────────────────────

  private async persist(keyId: string, payload: string): Promise<void> {
    // Import dynamically to avoid circular dependency at module init
    const { getRepository } = await import('typeorm');
    const { PatientDekEntity } = await import('../entities/patient-dek.entity');
    const repo = getRepository(PatientDekEntity);
    await repo.save({
      patientAddress: keyId,
      ciphertext: payload,
      iv: '',
      authTag: '',
      masterKeyVersion: this.keyId,
    } as any);
  }

  private async loadRaw(keyId: string): Promise<string | null> {
    const { getRepository } = await import('typeorm');
    const { PatientDekEntity } = await import('../entities/patient-dek.entity');
    const repo = getRepository(PatientDekEntity);
    const entity = await repo.findOne({ where: { patientAddress: keyId } as any });
    return entity?.ciphertext ?? null;
  }
}
