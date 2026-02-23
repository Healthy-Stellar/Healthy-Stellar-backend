import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { FhirController } from './controllers/fhir.controller';
import { FhirService } from './fhir.service';
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
    TypeOrmModule.forFeature([Patient, MedicalRecord, MedicalRecordConsent, MedicalHistory, BulkExportJob]),
    BullModule.registerQueue({ name: 'fhir-bulk-export' }),
    ScheduleModule.forRoot(),
  ],
  controllers: [FhirController],
  providers: [FhirService, BulkExportService, BulkExportProcessor, BulkExportCleanupTask],
  exports: [FhirService, BulkExportService],
})
export class FhirModule {}
