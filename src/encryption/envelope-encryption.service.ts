import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
  EncryptCommand,
} from '@aws-sdk/client-kms';
import * as crypto from 'crypto';

/** Raw bytes of an AES-256 data-encryption key */
export type PlaintextDek = Buffer;

export interface SealedEnvelope {
  /** Base64-encoded ciphertext of the DEK, wrapped by the KEK in KMS */
  encryptedDek: string;
  /** KMS key ARN / alias that was used to wrap this DEK */
  kekArn: string;
  /** The KMS key-version label stored in the tenant record at wrap time */
  kekVersion: string;
}

export interface EncryptedPayload {
  /** Base64-encoded AES-256-GCM ciphertext */
  ciphertext: string;
  /** Base64-encoded 12-byte IV */
  iv: string;
  /** Base64-encoded 16-byte GCM auth tag */
  authTag: string;
}

@Injectable()
export class EnvelopeEncryptionService {
  private readonly logger = new Logger(EnvelopeEncryptionService.name);
  private readonly kms: KMSClient;

  constructor() {
    this.kms = new KMSClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
    });
  }

  // ─── DEK generation ────────────────────────────────────────────────────────

  /**
   * Ask KMS to generate a fresh 256-bit DEK and return it in two forms:
   *  • plaintext – used once to encrypt the file, then discarded
   *  • ciphertext – stored in the database alongside the file record
   *
   * @param kekArn   KMS key ARN / alias for the tenant KEK
   * @param kekVersion  Opaque version label stored on the tenant row
   */
  async generateDek(
    kekArn: string,
    kekVersion: string,
  ): Promise<{ plaintext: PlaintextDek; envelope: SealedEnvelope }> {
    const cmd = new GenerateDataKeyCommand({
      KeyId: kekArn,
      KeySpec: 'AES_256',
    });

    const resp = await this.kms.send(cmd);

    if (!resp.Plaintext || !resp.CiphertextBlob) {
      throw new InternalServerErrorException(
        'KMS GenerateDataKey returned incomplete response',
      );
    }

    return {
      plaintext: Buffer.from(resp.Plaintext),
      envelope: {
        encryptedDek: Buffer.from(resp.CiphertextBlob).toString('base64'),
        kekArn,
        kekVersion,
      },
    };
  }

  // ─── DEK unwrapping ────────────────────────────────────────────────────────

  /**
   * Unwrap a stored encrypted DEK back to plaintext using KMS Decrypt.
   * KMS automatically uses the correct CMK embedded in the ciphertext blob,
   * so no kekArn is needed here (though passing it adds a security assertion).
   */
  async unwrapDek(encryptedDek: string): Promise<PlaintextDek> {
    const cmd = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedDek, 'base64'),
    });

    const resp = await this.kms.send(cmd);

    if (!resp.Plaintext) {
      throw new InternalServerErrorException(
        'KMS Decrypt returned no plaintext',
      );
    }

    return Buffer.from(resp.Plaintext);
  }

  // ─── Re-wrapping (key rotation) ────────────────────────────────────────────

  /**
   * Re-wrap an existing encrypted DEK under a new KEK **without touching
   * the file data**.  Steps:
   *  1. Decrypt the old encrypted DEK with the old KEK (via KMS Decrypt)
   *  2. Encrypt the same plaintext DEK under the new KEK (via KMS Encrypt)
   *  3. Return a new SealedEnvelope with the new encrypted DEK
   *
   * The file ciphertext stored in S3/local storage is never touched.
   */
  async rewrapDek(
    oldEncryptedDek: string,
    newKekArn: string,
    newKekVersion: string,
  ): Promise<SealedEnvelope> {
    // Step 1 – decrypt with the key embedded in the ciphertext blob
    const plaintext = await this.unwrapDek(oldEncryptedDek);

    // Step 2 – re-encrypt under the new KEK
    const encryptCmd = new EncryptCommand({
      KeyId: newKekArn,
      Plaintext: plaintext,
    });

    const encryptResp = await this.kms.send(encryptCmd);

    if (!encryptResp.CiphertextBlob) {
      throw new InternalServerErrorException(
        'KMS Encrypt returned no ciphertext',
      );
    }

    // Zero out the plaintext DEK from memory as soon as possible
    plaintext.fill(0);

    return {
      encryptedDek: Buffer.from(encryptResp.CiphertextBlob).toString('base64'),
      kekArn: newKekArn,
      kekVersion: newKekVersion,
    };
  }

  // ─── AES-256-GCM helpers ───────────────────────────────────────────────────

  /**
   * Encrypt arbitrary bytes with a plaintext DEK using AES-256-GCM.
   * The DEK buffer is zeroed after use.
   */
  encryptWithDek(plaintext: Buffer, dek: PlaintextDek): EncryptedPayload {
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag(); // 128-bit tag

    dek.fill(0); // clear DEK from memory

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  /**
   * Decrypt AES-256-GCM ciphertext using a plaintext DEK.
   * The DEK buffer is zeroed after use.
   */
  decryptWithDek(payload: EncryptedPayload, dek: PlaintextDek): Buffer {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      dek,
      Buffer.from(payload.iv, 'base64'),
    );

    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final(),
    ]);

    dek.fill(0); // clear DEK from memory

    return plaintext;
  }
}