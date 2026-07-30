import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyMedicalInfo } from './entities/emergency-medical-info.entity';
import { EmergencyMedicalInfoService } from './services/emergency-medical-info.service';
import { EmergencyQrService } from './services/emergency-qr.service';
import { EmergencyMedicalInfoController } from './controllers/emergency-medical-info.controller';
import { EmergencyQrController, EmergencyQrPublicController } from './controllers/emergency-qr.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([EmergencyMedicalInfo])],
  controllers: [
    EmergencyMedicalInfoController,
    EmergencyQrController,
    EmergencyQrPublicController,
  ],
  providers: [EmergencyMedicalInfoService, EmergencyQrService],
  exports: [EmergencyMedicalInfoService, EmergencyQrService],
})
export class EmergencyMedicalInfoModule {}
