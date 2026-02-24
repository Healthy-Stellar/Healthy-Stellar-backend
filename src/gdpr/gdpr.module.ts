import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { GdprController } from './controllers/gdpr.controller';
import { GdprService } from './services/gdpr.service';
import { GdprRequest } from './entities/gdpr-request.entity';
import { GdprProcessor } from './processors/gdpr.processor';
import { AuthModule } from '../auth/auth.module';
import { PatientModule } from '../patients/patients.module';
import { RecordsModule } from '../records/records.module';
import { MedicalRecordsModule } from '../medical-records/medical-records.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StellarModule } from '../stellar/stellar.module';
import { User } from '../auth/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Record } from '../records/entities/record.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { AuditLogEntity } from '../common/audit/audit-log.entity';

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
  ],
  controllers: [GdprController],
  providers: [GdprService, GdprProcessor],
  exports: [GdprService],
})
export class GdprModule {}
