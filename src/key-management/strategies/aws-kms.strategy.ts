import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KMSClient, GenerateDataKeyCommand, DecryptCommand, ReEncryptCommand } from '@aws-sdk/client-kms';
import { randomBytes } from 'crypto';
import { KeyManagementStrategy, DataKeyResult, EncryptedKey } from '../interfaces/key-management.interface';
import { PatientDekEntity } from '../entities/patient-dek.entity';
import { KeyManagementException, KeyRotationException } from '../exceptions/key-management.exceptions';

@Injectable()
export class AwsKmsStrategy implements KeyManagementStrategy, OnModuleInit {
  private readonly logger = new Logger(AwsKmsStrategy.name);
  private client: KMSClient;
  private keyId: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(PatientDekEntity)
    private readonly dekRepo: Repository<PatientDekEntity>,
  ) {}

  onModuleInit(): void {
    this.keyId = this.config.getOrThrow<string>('AWS_KMS_KEY_ID');
    this.client = new KMSClient({
      region: this.config.get<string>('AWS_REGION', 'us-east-1'),
    });
    this.logger.log(`AwsKmsStrategy initialised with key ${this.keyId}`);
  }

  async generateDEK(patientAddress: string): Promise<DataKeyResult> {
    try {
      const result = await this.client.send(
        new GenerateDataKeyCommand({ KeyId: this.keyId, KeySpec: 'AES_256' }),
      );

      const encryptedKey: EncryptedKey = {
        ciphertext: Buffer.from(result.CiphertextBlob!),
        iv: Buffer.alloc(0),
        authTag: Buffer.alloc(0),
        masterKeyVersion: this.keyId,
      };

      await this.dekRepo.save({
        patientAddress,
        ciphertext: encryptedKey.ciphertext.toString('hex'),
        iv: '',
        authTag: '',
        masterKeyVersion: this.keyId,
      });

      return { encryptedKey, plainKey: Buffer.from(result.Plaintext!) };
    } catch (err) {
      throw new KeyManagementException(`AWS KMS generateDEK failed: ${err.message}`);
    }
  }

  async decryptDEK(encryptedKey: EncryptedKey): Promise<Buffer> {
    try {
      const result = await this.client.send(
        new DecryptCommand({ CiphertextBlob: encryptedKey.ciphertext, KeyId: this.keyId }),
      );
      return Buffer.from(result.Plaintext!);
    } catch (err) {
      throw new KeyManagementException(`AWS KMS decryptDEK failed: ${err.message}`);
    }
  }

  async rotateMasterKey(): Promise<void> {
    const deks = await this.dekRepo.find();
    this.logger.log(`Re-encrypting ${deks.length} DEKs under new KMS key version`);

    for (const dek of deks) {
      try {
        const result = await this.client.send(
          new ReEncryptCommand({
            CiphertextBlob: Buffer.from(dek.ciphertext, 'hex'),
            DestinationKeyId: this.keyId,
          }),
        );
        await this.dekRepo.save({
          ...dek,
          ciphertext: Buffer.from(result.CiphertextBlob!).toString('hex'),
        });
      } catch (err) {
        throw new KeyRotationException(dek.patientAddress, err.message);
      }
    }

    this.logger.log('AWS KMS key rotation complete');
  }
}
