import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { Patient } from './entities/patient.entity';
import { PatientGuardian } from './entities/patient-guardian.entity';
import { PatientPrivacyGuard } from './guards/patient-privacy.guard';
import { GeoRestrictionGuard } from './guards/geo-restriction.guard';
import { GuardianAccessGuard } from './guards/guardian-access.guard';
import { GuardianService } from './services/guardian.service';
import { GuardianController } from './controllers/guardian.controller';
import { GuardianAgeOutTask } from './tasks/guardian-age-out.task';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, PatientGuardian]),
    ScheduleModule.forRoot(),
    AuthModule,
  ],
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
})
export class PatientModule {}
