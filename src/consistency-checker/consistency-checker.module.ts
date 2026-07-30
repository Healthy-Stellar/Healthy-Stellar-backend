import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { MedicalRecordVersion } from '../medical-records/entities/medical-record-version.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { User } from '../auth/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { StellarTransaction } from '../analytics/entities/stellar-transaction.entity';
import { ConsistencyIncident } from './consistency-incident.entity';
import { CommonModule } from '../common/common.module';
import { FeatureFlagModule } from '../feature-flags/feature-flag.module';
import { ConsistencyCheckerService } from './consistency-checker.service';
import { ConsistencyCheckerTask } from './consistency-checker.task';
import { ConsistencyCheckerController } from './consistency-checker.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicalRecord,
      MedicalRecordVersion,
      AccessGrant,
      User,
      Patient,
      StellarTransaction,
      ConsistencyIncident,
    ]),
    CommonModule,
    FeatureFlagModule,
  ],
  controllers: [ConsistencyCheckerController],
  providers: [ConsistencyCheckerService, ConsistencyCheckerTask],
  exports: [ConsistencyCheckerService],
})
export class ConsistencyCheckerModule {}
