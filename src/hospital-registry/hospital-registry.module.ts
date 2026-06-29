import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HospitalRegistry } from './entities/hospital-registry.entity';
import { PatientTransfer } from './entities/patient-transfer.entity';
import { HospitalRegistryService } from './services/hospital-registry.service';
import { TransferService } from './services/transfer.service';
import { HospitalRegistryController } from './controllers/hospital-registry.controller';
import { TransferController } from './controllers/transfer.controller';
import { MedicalRecordsModule } from '../medical-records/medical-records.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HospitalRegistry, PatientTransfer]),
    MedicalRecordsModule,
    AccessControlModule,
    NotificationsModule,
  ],
  controllers: [HospitalRegistryController, TransferController],
  providers: [HospitalRegistryService, TransferService],
  exports: [HospitalRegistryService, TransferService],
})
export class HospitalRegistryModule {}
