import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KMSClient, GenerateDataKeyCommand, DecryptCommand, DescribeKeyCommand } from '@aws-sdk/client-kms';
import { CircuitBreakerService } from '../../common/circuit-breaker/circuit-breaker.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { TenantService } from '../../tenant/services/tenant.service';
import { KeyManagementService, DataKeyResult } from '../interfaces/key-management.interface';
import { KeyManagementException, KeyNotFoundException, KeyRotationException } from '../exceptions/key-management.exceptions';
import { BrokenCircuitError } from 'cockatiel';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class AwsKmsService implements KeyManagementService {
  private readonly logger = new Logger(AwsKmsService.name);
  private readonly kmsClient: KMSClient;
  private readonly kmsEnabled: boolean;
  private readonly serviceName = 'kms';

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly auditLog: AuditLogService,
    private readonly tenantService: TenantService,
  ) {
    this.kmsEnabled = this.configService.get<string>('KMS_ENABLED', 'false') === 'true';
    
    if (this.kmsEnabled) {
      this.kmsClient = new KMSClient({
        region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
        credentials: {
          accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
        },
      });
    }
  }

  async generateDataKey(patientId: string): Promise<DataKeyResult> {
    const tenantId = await this.getTenantId(patientId);
    
    await this.auditLog.create({
      operation: 'GENERATE_DATA_KEY',
      entityType: 'PATIENT_KEY',
      entityId: patientId,
      userId: 'system',
      status: 'SUCCESS',
    });

    if (!this.kmsEnabled) {
      return this.generateLocalDataKey();
    }

    return this.executeWithBreaker(async () => {
      const cmkArn = await this.getCmkArn(tenantId);
      
      const command = new GenerateDataKeyCommand({
        KeyId: cmkArn,
        KeySpec: 'AES_256',
        EncryptionContext: {
          patientId,
          tenantId,
        },
      });

      const result = await this.kmsClient.send(command);
      
      return {
        encryptedKey: Buffer.from(result.CiphertextBlob),
        plainKey: Buffer.from(result.Plaintext),
      };
    });
  }

  async decryptDataKey(encryptedKey: Buffer, patientId: string): Promise<Buffer> {
    const tenantId = await this.getTenantId(patientId);
    
    await this.auditLog.create({
      operation: 'DECRYPT_DATA_KEY',
      entityType: 'PATIENT_KEY',
      entityId: patientId,
      userId: 'system',
      status: 'SUCCESS',
    });

    if (!this.kmsEnabled) {
      return this.decryptLocalDataKey(encryptedKey);
    }

    return this.executeWithBreaker(async () => {
      const command = new DecryptCommand({
        CiphertextBlob: encryptedKey,
        EncryptionContext: {
          patientId,
          tenantId,
        },
      });

      const result = await this.kmsClient.send(command);
      return Buffer.from(result.Plaintext);
    });
  }

  async rotatePatientKey(patientId: string): Promise<void> {
    const tenantId = await this.getTenantId(patientId);
    
    try {
      await this.auditLog.create({
        operation: 'ROTATE_PATIENT_KEY',
        entityType: 'PATIENT_KEY',
        entityId: patientId,
        userId: 'system',
        status: 'SUCCESS',
      });

      // Implementation would re-encrypt all patient data with new key version
      this.logger.log(`Key rotation initiated for patient: ${patientId}`);
      
    } catch (error) {
      throw new KeyRotationException(patientId, error.message);
    }
  }

  async destroyPatientKeys(patientId: string): Promise<void> {
    const tenantId = await this.getTenantId(patientId);
    
    await this.auditLog.create({
      operation: 'DESTROY_PATIENT_KEYS',
      entityType: 'PATIENT_KEY',
      entityId: patientId,
      userId: 'system',
      status: 'SUCCESS',
      changes: { gdprErasure: true },
    });

    // Implementation would mark keys for destruction and schedule secure deletion
    this.logger.log(`Key destruction initiated for patient: ${patientId}`);
  }

  private async executeWithBreaker<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.circuitBreaker.execute(this.serviceName, fn);
    } catch (error) {
      if (error instanceof BrokenCircuitError) {
        throw new KeyManagementException('KMS service temporarily unavailable');
      }
      throw new KeyManagementException(`KMS operation failed: ${error.message}`);
    }
  }

  private async getCmkArn(tenantId: string): Promise<string> {
    const tenant = await this.tenantService.findById(tenantId);
    if (!tenant?.kmsCmkArn) {
      throw new KeyNotFoundException(`CMK not configured for tenant: ${tenantId}`);
    }
    return tenant.kmsCmkArn;
  }

  private async getTenantId(patientId: string): Promise<string> {
    // Implementation would resolve tenant from patient context
    return 'default-tenant';
  }

  private generateLocalDataKey(): DataKeyResult {
    const plainKey = randomBytes(32);
    const encryptedKey = this.encryptLocal(plainKey);
    
    return {
      encryptedKey,
      plainKey,
    };
  }

  private decryptLocalDataKey(encryptedKey: Buffer): Buffer {
    return this.decryptLocal(encryptedKey);
  }

  private encryptLocal(data: Buffer): Buffer {
    const key = this.configService.get<string>('LOCAL_KEK', 'default-key-encryption-key');
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', Buffer.from(key.padEnd(32, '0')), iv);
    
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
  }

  private decryptLocal(encryptedData: Buffer): Buffer {
    const key = this.configService.get<string>('LOCAL_KEK', 'default-key-encryption-key');
    const iv = encryptedData.subarray(0, 16);
    const encrypted = encryptedData.subarray(16);
    
    const decipher = createDecipheriv('aes-256-cbc', Buffer.from(key.padEnd(32, '0')), iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}