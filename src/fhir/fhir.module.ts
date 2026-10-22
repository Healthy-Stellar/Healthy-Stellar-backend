import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';

import { FhirController } from './controllers/fhir.controller';
import { FhirService } from './services/fhir.service';
import { FhirValidatorService } from './services/fhir-validator.service';
import { FhirMapperService } from './mappers/fhir-mapper.service';

import { PatientMapper } from './mappers/patient.mapper';
import { DocumentReferenceMapper } from './mappers/document-reference.mapper';
import { ProvenanceMapper } from './mappers/provenance.mapper';
import { ConsentMapper } from './mappers/consent.mapper';
import { ObservationMapper } from './mappers/observation.mapper';
import { MedicationAdministrationMapper } from './mappers/medication-administration.mapper';
import { EncounterMapper } from './mappers/encounter.mapper';
import { DiagnosticReportMapper } from './mappers/diagnostic-report.mapper';
import { ConditionMapper } from './mappers/condition.mapper';
import { ProcedureMapper } from './mappers/procedure.mapper';

import { BulkExportService } from './services/bulk-export.service';
import { BulkExportProcessor } from './processors/bulk-export.processor';
import { BulkExportCleanupTask } from './tasks/bulk-export-cleanup.task';

import { Patient } from '../patients/entities/patient.entity';
import { MedicalRecord } from '../medical-records/entities/medical-record.entity';
import { MedicalRecordConsent } from '../medical-records/entities/medical-record-consent.entity';
import { MedicalHistory } from '../medical-records/entities/medical-history.entity';
import { BulkExportJob } from './entities/bulk-export-job.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      MedicalRecord,
      MedicalRecordConsent,
      MedicalHistory,
      BulkExportJob,
    ]),
    BullModule.registerQueue({ name: 'fhir-bulk-export' }),
    ScheduleModule.forRoot(),
  ],
  controllers: [FhirController],
  providers: [
    FhirService,
    FhirValidatorService,
    FhirMapperService,
    PatientMapper,
    DocumentReferenceMapper,
    ProvenanceMapper,
    ConsentMapper,
    ObservationMapper,
    MedicationAdministrationMapper,
    EncounterMapper,
    DiagnosticReportMapper,
    ConditionMapper,
    ProcedureMapper,
    BulkExportService,
    BulkExportProcessor,
    BulkExportCleanupTask,
  ],
  exports: [FhirService, FhirMapperService, BulkExportService],
})
export class FhirModule {}
