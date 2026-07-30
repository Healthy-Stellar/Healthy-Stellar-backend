import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeyStore, KEY_STORE } from '../interfaces/key-store.interface';
import { DbKeyStore } from './db-key-store.service';
import { AwsKmsKeyStore } from './aws-kms-key-store.service';
import { KeyManagementException } from '../exceptions/key-management.exceptions';

/**
 * Factory that provides the correct KeyStore implementation based on
 * the KEY_STORAGE_BACKEND environment variable.
 *
 * Values:
 *   - 'database' (default) → DbKeyStore (local/test)
 *   - 'aws-kms'            → AwsKmsKeyStore (production)
 */
@Injectable()
export class KeyStoreFactory implements OnModuleInit {
  private readonly logger = new Logger(KeyStoreFactory.name);
  private store: KeyStore;

  constructor(
    private readonly config: ConfigService,
    private readonly dbKeyStore: DbKeyStore,
    private readonly awsKmsKeyStore: AwsKmsKeyStore,
  ) {}

  onModuleInit(): void {
    const backend = this.config.get<string>('KEY_STORAGE_BACKEND', 'database');
    switch (backend) {
      case 'aws-kms':
        this.store = this.awsKmsKeyStore;
        this.logger.log('KeyStore backend: AWS KMS');
        break;
      case 'database':
        this.store = this.dbKeyStore;
        this.logger.log('KeyStore backend: Database (local)');
        break;
      default:
        throw new KeyManagementException(
          `Unknown KEY_STORAGE_BACKEND: ${backend}. Use 'database' or 'aws-kms'.`,
        );
    }
  }

  getStore(): KeyStore {
    return this.store;
  }
}
