import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { PatientTimelineService } from './services/patient-timeline.service';
import { Patient } from './entities/patient.entity';
feat/tenant-branding
import { PatientGuardian } from './entities/patient-guardian.entity';

import { CorrectionRequest } from './entities/correction-request.entity';
import { MedicalHistory } from '../medical-records/entities/medical-history.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
 main
import { PatientPrivacyGuard } from './guards/patient-privacy.guard';
import { GeoRestrictionGuard } from './guards/geo-restriction.guard';
import { GuardianAccessGuard } from './guards/guardian-access.guard';
import { GuardianService } from './services/guardian.service';
import { GuardianController } from './controllers/guardian.controller';
import { GuardianAgeOutTask } from './tasks/guardian-age-out.task';
import { AuthModule } from '../auth/auth.module';
import { PatientProvidersController } from './controllers/patient-providers.controller';
import { PatientPortalController } from './controllers/patient-portal.controller';
import { PatientProvidersService } from './services/patient-providers.service';
import { PatientPortalService } from './services/patient-portal.service';
import { CommonModule } from '../common/common.module';
import { StellarModule } from '../stellar/stellar.module';
import { MedicalValidationModule } from '../data-validation-integrity/medical-validation.module';

@Module({
  imports: [
feat/tenant-branding
    TypeOrmModule.forFeature([Patient, PatientGuardian]),
    ScheduleModule.forRoot(),

    TypeOrmModule.forFeature([Patient, MedicalHistory, AccessGrant, CorrectionRequest]),
main
    AuthModule,
    CommonModule,
    StellarModule,
    MedicalValidationModule,
  ],
 feat/tenant-branding
  controllers: [PatientsController, GuardianController],
  providers: [
    PatientsService,
    PatientPrivacyGuard,
    GeoRestrictionGuard,
    GuardianService,
    GuardianAccessGuard,
    GuardianAgeOutTask,
  ],
  exports: [PatientsService, GeoRestrictionGuard, GuardianService, GuardianAccessGuard],

  controllers: [PatientsController, PatientProvidersController, PatientPortalController],
  providers: [
    PatientsService,
    PatientPrivacyGuard,
    GeoRestrictionGuard,
    GuardianService,
    GuardianAccessGuard,
    GuardianAgeOutTask,
  ],
  exports: [PatientsService, PatientTimelineService, GeoRestrictionGuard, PatientPortalService],
 main
})
export class PatientModule {}
