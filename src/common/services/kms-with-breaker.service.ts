import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DecryptCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import type { KeySpec } from '@aws-sdk/client-kms';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';
import { BrokenCircuitError } from 'cockatiel';
import { CircuitOpenException } from '../circuit-breaker/exceptions/circuit-open.exception';
import { CIRCUIT_BREAKER_CONFIGS } from '../circuit-breaker/circuit-breaker.config';

/**
 * Key Management Service with circuit breaker protection
 */
@Injectable()
export class KmsWithBreakerService {
  private readonly logger = new Logger(KmsWithBreakerService.name);
  private readonly serviceName = 'kms';
  private readonly kmsClient: KMSClient;

  constructor(
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly configService: ConfigService,
  ) {
    const provider = this.configService.get<string>('KMS_PROVIDER', 'aws');
    const region = this.configService.get<string>('AWS_REGION');

    if (provider !== 'aws') {
      throw new Error(`Unsupported KMS_PROVIDER '${provider}'. Configure AWS KMS before starting.`);
    }

    if (!region) {
      throw new Error('AWS_REGION must be set for AWS KMS encryption');
    }

    this.kmsClient = new KMSClient({ region });
  }

  /**
   * Encrypt data using KMS
   */
  async encrypt(plaintext: Buffer, keyId: string): Promise<Buffer> {
    return this.executeWithBreaker(async () => {
      this.logger.debug(`[KMS] Encrypting data with key: ${keyId}`);
      const result = await this.kmsClient.send(
        new EncryptCommand({
          KeyId: keyId,
          Plaintext: plaintext,
        }),
      );

      if (!result.CiphertextBlob) {
        throw new Error('AWS KMS encrypt response did not include CiphertextBlob');
      }

      return Buffer.from(result.CiphertextBlob);
    });
  }

  /**
   * Decrypt data using KMS
   */
  async decrypt(ciphertext: Buffer, keyId: string): Promise<Buffer> {
    return this.executeWithBreaker(async () => {
      this.logger.debug(`[KMS] Decrypting data with key: ${keyId}`);
      const result = await this.kmsClient.send(
        new DecryptCommand({
          KeyId: keyId,
          CiphertextBlob: ciphertext,
        }),
      );

      if (!result.Plaintext) {
        throw new Error('AWS KMS decrypt response did not include Plaintext');
      }

      return Buffer.from(result.Plaintext);
    });
  }

  /**
   * Generate a data encryption key
   */
  async generateDataKey(keyId: string, keySpec: string = 'AES_256'): Promise<{
    plaintext: Buffer;
    ciphertext: Buffer;
  }> {
    return this.executeWithBreaker(async () => {
      this.logger.debug(`[KMS] Generating data key with spec: ${keySpec}`);
      const result = await this.kmsClient.send(
        new GenerateDataKeyCommand({
          KeyId: keyId,
          KeySpec: keySpec as KeySpec,
        }),
      );

      if (!result.Plaintext || !result.CiphertextBlob) {
        throw new Error('AWS KMS generateDataKey response was missing key material');
      }

      return {
        plaintext: Buffer.from(result.Plaintext),
        ciphertext: Buffer.from(result.CiphertextBlob),
      };
    });
  }

  private async executeWithBreaker<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.circuitBreaker.execute(this.serviceName, fn);
    } catch (error) {
      if (error instanceof BrokenCircuitError) {
        const config = CIRCUIT_BREAKER_CONFIGS[this.serviceName];
        throw new CircuitOpenException(this.serviceName, config.halfOpenAfter);
      }
      throw error;
    }
  }
}
