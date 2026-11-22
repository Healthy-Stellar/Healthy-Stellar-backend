import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientDekEntity } from './entities/patient-dek.entity';
import { DbKeyStore } from './services/db-key-store.service';
import { AwsKmsKeyStore } from './services/aws-kms-key-store.service';
import { KEY_STORE, KeyStore, StoredKey } from './interfaces/key-store.interface';

const logger = new Logger('KeyStoreModule');

/**
 * Builds the persistent KeyStore selected by KEY_STORAGE_BACKEND.
 *   - 'aws-kms'  → AwsKmsKeyStore (production)
 *   - otherwise  → DbKeyStore (database, encrypted at rest)
 *
 * Only the selected backend is constructed, so the other backend's
 * configuration (e.g. AWS_KMS_KEY_ID) is not required.
 */
export function createKeyStore(
  config: ConfigService,
  dekRepo: Repository<PatientDekEntity>,
): KeyStore {
  const backend = config.get<string>('KEY_STORAGE_BACKEND', 'database');
  if (backend === 'aws-kms') {
    return new AwsKmsKeyStore(config);
  }
  if (backend !== 'database') {
    logger.warn(
      `KEY_STORAGE_BACKEND='${backend}' is not a persistent backend; using 'database'.`,
    );
  }
  return new DbKeyStore(config, dekRepo);
}

/**
 * Defers backend construction to first use so that importing this module
 * does not change application boot behaviour; misconfiguration surfaces as
 * an error on the first key operation instead.
 */
class LazyKeyStore implements KeyStore {
  private store?: KeyStore;

  constructor(private readonly create: () => KeyStore) {}

  private get backend(): KeyStore {
    if (!this.store) {
      this.store = this.create();
    }
    return this.store;
  }

  storeKey(keyId: string, secretKey: string): Promise<void> {
    return this.backend.storeKey(keyId, secretKey);
  }

  retrieveKey(keyId: string): Promise<string> {
    return this.backend.retrieveKey(keyId);
  }

  deleteKey(keyId: string): Promise<void> {
    return this.backend.deleteKey(keyId);
  }

  listKeys(): Promise<StoredKey[]> {
    return this.backend.listKeys();
  }

  rotateWrappingKey(): Promise<{ rewrappedCount: number }> {
    return this.backend.rotateWrappingKey();
  }
}

/**
 * Minimal module exposing the persistent KEY_STORE, without the
 * key-management admin/rotation controllers.
 */
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([PatientDekEntity])],
  providers: [
    {
      provide: KEY_STORE,
      inject: [ConfigService, getRepositoryToken(PatientDekEntity)],
      useFactory: (config: ConfigService, dekRepo: Repository<PatientDekEntity>): KeyStore =>
        new LazyKeyStore(() => createKeyStore(config, dekRepo)),
    },
  ],
  exports: [KEY_STORE],
})
export class KeyStoreModule {}
