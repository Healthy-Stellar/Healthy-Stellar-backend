import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { MedicalRecord } from './entities/medical-record.entity';
import { MedicalRecordVersion } from './entities/medical-record-version.entity';
import { MedicalHistory } from './entities/medical-history.entity';
import { ClinicalNoteTemplate } from './entities/clinical-note-template.entity';
import { MedicalAttachment } from './entities/medical-attachment.entity';
import { MedicalRecordConsent } from './entities/medical-record-consent.entity';
import { ClinicalNote } from './entities/clinical-note.entity';
import { ReportJob } from './entities/report-job.entity';
import { AccessControlModule } from '../access-control/access-control.module';
import { ProviderPatientModule } from '../provider-patient/provider-patient.module';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { MailModule } from '../email-notification-service-for-critical-access-events/mail.module';

import { MedicalRecordsService } from './services/medical-records.service';
import { ClinicalTemplatesService } from './services/clinical-templates.service';
import { ConsentService } from './services/consent.service';
import { FileUploadService } from './services/file-upload.service';
import { ReportingService } from './services/reporting.service';
import { ReportGenerationService } from './services/report-generation.service';
import { ReportBuilderService } from './services/report-builder.service';
import { IpfsService } from './services/ipfs.service';
import { EmailService } from './services/email.service';
import { ClinicalNotesService } from './services/clinical-notes.service';

import { MedicalRecordsController } from './controllers/medical-records.controller';
import { ClinicalTemplatesController } from './controllers/clinical-templates.controller';
import { MedicalRecordSearchSubscriber } from './subscribers/medical-record-search.subscriber';
import { ConsentController } from './controllers/consent.controller';
import { FileUploadController } from './controllers/file-upload.controller';
import { ReportingController } from './controllers/reporting.controller';
import { ClinicalNotesController } from './controllers/clinical-notes.controller';

import { ReportProcessor } from './processors/report.processor';
import { OcrProcessor } from './processors/ocr.processor';

import { Patient } from '../patients/entities/patient.entity';

@Module({
  imports: [
    ConfigModule,
    AccessControlModule,
    ProviderPatientModule,
    MailModule,
    TypeOrmModule.forFeature([
      MedicalRecord,
      MedicalRecordVersion,
      MedicalHistory,
      ClinicalNoteTemplate,
      ClinicalNote,
      MedicalAttachment,
      MedicalRecordConsent,
      ReportJob,
      Patient,
    ]),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.REPORTS },
      { name: QUEUE_NAMES.OCR },
    ),
  ],
  controllers: [
    MedicalRecordsController,
    ClinicalTemplatesController,
    ConsentController,
    FileUploadController,
    ReportingController,
    ClinicalNotesController,
  ],
  providers: [
    MedicalRecordsService,
    ClinicalTemplatesService,
    ConsentService,
    FileUploadService,
    ReportingService,
    ReportGenerationService,
    ReportBuilderService,
    IpfsService,
    EmailService,
    ClinicalNotesService,
    ReportProcessor,
    OcrProcessor,
    MedicalRecordSearchSubscriber,
  ],
  exports: [
    MedicalRecordsService,
    ClinicalTemplatesService,
    ConsentService,
    FileUploadService,
    ClinicalNotesService,
  ],
})
export class MedicalRecordsModule {}
