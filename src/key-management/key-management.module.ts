import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientDekEntity } from './entities/patient-dek.entity';
import { KeyRotationLog } from './entities/key-rotation-log.entity';
import { EnvelopeKeyManagementService } from './services/envelope-key-management.service';

import { AwsKmsStrategy } from './strategies/aws-kms.strategy';
import { KEY_MANAGEMENT_STRATEGY } from './interfaces/key-management.interface';
import { KeyStoreFactory } from './services/key-store-factory.service';
import { DbKeyStore } from './services/db-key-store.service';
import { AwsKmsKeyStore } from './services/aws-kms-key-store.service';
import { KEY_STORE } from './interfaces/key-store.interface';


import { KeyManagementAdminController } from './controllers/key-management-admin.controller';


export const KEY_MANAGEMENT_SERVICE = 'KeyManagementService';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([PatientDekEntity, KeyRotationLog]),
  ],
  controllers: [KeyManagementAdminController],

  providers: [
    EnvelopeKeyManagementService,
    AwsKmsStrategy,
    // KeyStore adapters for Stellar secret key storage (Issue #660)
    DbKeyStore,
    AwsKmsKeyStore,
    KeyStoreFactory,
    {
      provide: KEY_STORE,
      inject: [KeyStoreFactory],
      useFactory: (factory: KeyStoreFactory) => factory.getStore(),
    },
    {
      provide: KEY_MANAGEMENT_STRATEGY,
      inject: [ConfigService, EnvelopeKeyManagementService, AwsKmsStrategy],
      useFactory: (
        config: ConfigService,
        local: EnvelopeKeyManagementService,
        aws: AwsKmsStrategy,
      ) => {
        const provider = config.get<string>('KEY_MANAGEMENT_PROVIDER', 'local');
        switch (provider) {
          case 'aws':
            return aws;
          case 'gcp':
            throw new Error('GCP KMS strategy is not yet implemented');
          default:
            return local;
        }
      },
    },
    {
      provide: KEY_MANAGEMENT_SERVICE,
      useExisting: KEY_MANAGEMENT_STRATEGY,
    },
  ],
  exports: [KEY_MANAGEMENT_SERVICE, KEY_MANAGEMENT_STRATEGY, KEY_STORE],
})
export class KeyManagementModule {}
