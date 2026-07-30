import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { GdprController } from './controllers/gdpr.controller';
import { GdprService } from './services/gdpr.service';
import { DeletionRegistryService } from './services/deletion-registry.service';
import { GdprRequest } from './entities/gdpr-request.entity';
import { GdprProcessor } from './processors/gdpr.processor';
import { AuthModule } from '../auth/auth.module';
import { PatientModule } from '../patients/patients.module';
import { RecordsModule } from '../records/records.module';
import { MedicalRecordsModule } from '../medical-records/medical-records.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StellarModule } from '../stellar/stellar.module';
import { DataRetentionModule } from '../data-retention/data-retention.module';
import { User } from '../auth/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Record } from '../records/entities/record.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { AuditLogEntity } from '../common/audit/audit-log.entity';
import { GdprComplianceLog } from './entities/gdpr-compliance-log.entity';
import { Billing } from '../billing/entities/billing.entity';
import { LabOrder } from '../laboratory/entities/lab-order.entity';
import { Specimen } from '../laboratory/entities/specimen.entity';
import { LabResult } from '../laboratory/entities/lab-result.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GdprRequest,
      User,
      Patient,
      Record,
      MedicalRecord,
      AccessGrant,
      AuditLogEntity,
      GdprComplianceLog,
      Billing,
      LabOrder,
      Specimen,
      LabResult,
    ]),
    BullModule.registerQueue({
      name: 'gdpr',
    }),
    AuthModule,
    PatientModule,
    RecordsModule,
    MedicalRecordsModule,
    AccessControlModule,
    NotificationsModule,
    StellarModule,
    DataRetentionModule,
  ],
  controllers: [GdprController],
  providers: [GdprService, GdprProcessor, DeletionRegistryService],
  exports: [GdprService, DeletionRegistryService],
})
export class GdprModule {}
