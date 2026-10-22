import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
  ReEncryptCommand,
} from '@aws-sdk/client-kms';

import {
  EncryptedKey,
  DataKeyResult,
  KeyManagementStrategy,
} from '../interfaces/key-management.interface';
import { KeyManagementException, KeyRotationException } from '../exceptions/key-management.exceptions';

@Injectable()
export class AwsKmsStrategy implements KeyManagementStrategy {
  private readonly logger = new Logger(AwsKmsStrategy.name);
  private readonly client: KMSClient;
  private readonly masterKeyId: string;

  constructor(private readonly config: ConfigService) {
    this.client = new KMSClient({
      region: this.config.get<string>('AWS_REGION'),
    });
    this.masterKeyId = this.config.get<string>('AWS_KMS_MASTER_KEY_ID');
    if (!this.masterKeyId) {
      throw new KeyManagementException('AWS_KMS_MASTER_KEY_ID environment variable is required');
    }
  }

  async generateDEK(patientAddress: string): Promise<DataKeyResult> {
    const command = new GenerateDataKeyCommand({
      KeyId: this.masterKeyId,
      KeySpec: 'AES_256',
      EncryptionContext: { patientAddress },
    });

    const response = await this.client.send(command);
    if (!response.Plaintext || !response.CiphertextBlob) {
      throw new KeyManagementException('KMS GenerateDataKey returned an incomplete response');
    }

    return {
      plainKey: Buffer.from(response.Plaintext),
      encryptedKey: {
        ciphertext: Buffer.from(response.CiphertextBlob),
        iv: Buffer.alloc(0),
        authTag: Buffer.alloc(0),
        masterKeyVersion: this.masterKeyId,
      },
    };
  }

  async decryptDEK(encryptedKey: EncryptedKey): Promise<Buffer> {
    const command = new DecryptCommand({
      CiphertextBlob: encryptedKey.ciphertext,
      KeyId: this.masterKeyId,
    });

    const response = await this.client.send(command);
    if (!response.Plaintext) {
      throw new KeyManagementException('KMS Decrypt returned an incomplete response');
    }

    return Buffer.from(response.Plaintext);
  }

  async rotateMasterKey(operatorId: string): Promise<{ reencryptedCount: number }> {
    const newKeyId = this.config.get<string>('AWS_KMS_MASTER_KEY_ID_NEW');
    if (!newKeyId) {
      throw new KeyRotationException('all', 'AWS_KMS_MASTER_KEY_ID_NEW not set');
    }

    this.logger.log(`Starting AWS KMS master key rotation (${this.masterKeyId} → ${newKeyId}) by ${operatorId}`);

    let reencryptedCount = 0;
    try {
      const deks = await this.dekRepo.find();
      for (const dek of deks) {
        const command = new ReEncryptCommand({
          CiphertextBlob: Buffer.from(dek.ciphertext, 'hex'),
          SourceKeyId: this.masterKeyId,
          DestinationKeyId: newKeyId,
        });

        const response = await this.client.send(command);
        if (!response.CiphertextBlob) {
          throw new KeyManagementException('KMS ReEncrypt returned an incomplete response');
        }

        await this.dekRepo.save({
          ...dek,
          ciphertext: Buffer.from(response.CiphertextBlob).toString('hex'),
          masterKeyVersion: newKeyId,
        });
        reencryptedCount++;
      }
    } catch (err) {
      throw new KeyRotationException('batch', err.message);
    }

    this.logger.log(`AWS KMS master key rotation complete — re-encrypted: ${reencryptedCount}`);
    return { reencryptedCount };
  }
}
