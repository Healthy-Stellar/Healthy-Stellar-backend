import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { Patient } from './entities/patient.entity';
import { PatientPrivacyGuard } from './guards/patient-privacy.guard';
import { GeoRestrictionGuard } from './guards/geo-restriction.guard';
import { AuthModule } from '../auth/auth.module';
import { PatientProvidersController } from './controllers/patient-providers.controller';
import { PatientProvidersService } from './services/patient-providers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient]),
    AuthModule,
  ],
  controllers: [PatientsController, PatientProvidersController],
  providers: [PatientsService, PatientPrivacyGuard, PatientProvidersService],
  exports: [PatientsService],
  controllers: [PatientsController],
  providers: [PatientsService, PatientPrivacyGuard, GeoRestrictionGuard],
  exports: [PatientsService, GeoRestrictionGuard],
})
export class PatientModule {}
