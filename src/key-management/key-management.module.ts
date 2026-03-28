import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientDekEntity } from './entities/patient-dek.entity';
import { EnvelopeKeyManagementService } from './services/envelope-key-management.service';

export const KEY_MANAGEMENT_SERVICE = 'KeyManagementService';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([PatientDekEntity]),
  ],
  providers: [
    EnvelopeKeyManagementService,
    {
      provide: KEY_MANAGEMENT_SERVICE,
      useExisting: EnvelopeKeyManagementService,
    },
  ],
  exports: [KEY_MANAGEMENT_SERVICE, EnvelopeKeyManagementService],
})
export class KeyManagementModule {}
