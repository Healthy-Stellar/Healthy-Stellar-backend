import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalRecord } from './entities/medical-record.entity';
import { MedicalRecordVersion } from './entities/medical-record-version.entity';
import { MedicalHistory } from './entities/medical-history.entity';
import { ClinicalNoteTemplate } from './entities/clinical-note-template.entity';
import { MedicalAttachment } from './entities/medical-attachment.entity';
import { MedicalRecordConsent } from './entities/medical-record-consent.entity';

import { MedicalRecordsService } from './services/medical-records.service';
import { ClinicalTemplatesService } from './services/clinical-templates.service';
import { ConsentService } from './services/consent.service';
import { FileUploadService } from './services/file-upload.service';

import { MedicalRecordsController } from './controllers/medical-records.controller';
import { ClinicalTemplatesController } from './controllers/clinical-templates.controller';
import { ConsentController } from './controllers/consent.controller';
import { FileUploadController } from './controllers/file-upload.controller';
import { ReportingController } from './controllers/reporting.controller';
import { ReportingService } from './services/reporting.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicalRecord,
      MedicalRecordVersion,
      MedicalHistory,
      ClinicalNoteTemplate,
      MedicalAttachment,
      MedicalRecordConsent,
    ]),
  ],
  controllers: [
    MedicalRecordsController,
    ClinicalTemplatesController,
    ConsentController,
    FileUploadController,
    ReportingController,
  ],
  providers: [
    MedicalRecordsService,
    ClinicalTemplatesService,
    ConsentService,
    FileUploadService,
    ReportingService,
  ],
  exports: [
    MedicalRecordsService,
    ClinicalTemplatesService,
    ConsentService,
    FileUploadService,
  ],
})
export class MedicalRecordsModule {}
