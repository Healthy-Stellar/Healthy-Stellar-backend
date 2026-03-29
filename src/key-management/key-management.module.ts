import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientDekEntity } from './entities/patient-dek.entity';
import { KeyRotationLog } from './entities/key-rotation-log.entity';
import { EnvelopeKeyManagementService } from './services/envelope-key-management.service';
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
    {
      provide: KEY_MANAGEMENT_SERVICE,
      useExisting: EnvelopeKeyManagementService,
    },
  ],
  exports: [KEY_MANAGEMENT_SERVICE, EnvelopeKeyManagementService],
})
export class KeyManagementModule {}
