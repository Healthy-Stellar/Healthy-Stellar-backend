import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FhirController } from './controllers/fhir.controller';
import { FhirService } from './fhir.service';
import { Patient } from '../patients/entities/patient.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { MedicalRecordConsent } from '../medical-records/entities/medical-record-consent.entity';
import { MedicalHistory } from '../medical-records/entities/medical-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, MedicalRecord, MedicalRecordConsent, MedicalHistory])
  ],
  controllers: [FhirController],
  providers: [FhirService],
  exports: [FhirService]
})
export class FhirModule {}
