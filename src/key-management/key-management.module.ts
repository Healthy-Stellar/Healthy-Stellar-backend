import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientDekEntity } from './entities/patient-dek.entity';
import { EnvelopeKeyManagementService } from './services/envelope-key-management.service';
import { AwsKmsStrategy } from './strategies/aws-kms.strategy';
import { KEY_MANAGEMENT_STRATEGY } from './interfaces/key-management.interface';

export const KEY_MANAGEMENT_SERVICE = 'KeyManagementService';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([PatientDekEntity])],
  providers: [
    EnvelopeKeyManagementService,
    AwsKmsStrategy,
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
  exports: [KEY_MANAGEMENT_SERVICE, KEY_MANAGEMENT_STRATEGY],
})
export class KeyManagementModule {}
