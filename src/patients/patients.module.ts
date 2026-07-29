import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { PatientTimelineService } from './services/patient-timeline.service';
import { Patient } from './entities/patient.entity';
import { CorrectionRequest } from './entities/correction-request.entity';
import { MedicalHistory } from '../medical-records/entities/medical-history.entity';
import { AccessGrant } from '../access-control/entities/access-grant.entity';
import { PatientPrivacyGuard } from './guards/patient-privacy.guard';
import { GeoRestrictionGuard } from './guards/geo-restriction.guard';
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
    TypeOrmModule.forFeature([Patient, MedicalHistory, AccessGrant, CorrectionRequest]),
    AuthModule,
    CommonModule,
    StellarModule,
    MedicalValidationModule,
  ],
  controllers: [PatientsController, PatientProvidersController, PatientPortalController],
  providers: [
    PatientsService,
    PatientTimelineService,
    PatientPrivacyGuard,
    GeoRestrictionGuard,
    PatientProvidersService,
    PatientPortalService,
  ],
  exports: [PatientsService, PatientTimelineService, GeoRestrictionGuard, PatientPortalService],
})
export class PatientModule {}
