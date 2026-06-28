import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { ImportJob } from './entities/import-job.entity';
import { ImportError } from './entities/import-error.entity';
import { Record } from '../records/entities/record.entity';
import { LabResult } from '../laboratory/entities/lab-result.entity';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { Hl7v2ImportController } from './hl7v2-import.controller';
import { EhrImportProcessor } from './ehr-import.processor';
import { Hl7Parser } from './parsers/hl7.parser';
import { CcdParser } from './parsers/ccd.parser';
import { CsvParser } from './parsers/csv.parser';
import { Hl7v2OruParser } from './parsers/hl7v2-oru.parser';
import { Hl7v2LabImportService } from './services/hl7v2-lab-import.service';
import { IpfsService } from '../records/services/ipfs.service';
import { StellarService } from '../records/services/stellar.service';
import { TracingService } from '../common/services/tracing.service';
import { TempStorageService } from './services/temp-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImportJob, ImportError, Record, LabResult]),
    MulterModule.register({ limits: { fileSize: 50 * 1024 * 1024 } }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.EHR_IMPORT,
    }),
  ],
  controllers: [ImportController, Hl7v2ImportController],
  providers: [
    ImportService, EhrImportProcessor, Hl7Parser, CcdParser, CsvParser,
    IpfsService, StellarService, TracingService, TempStorageService,
    Hl7v2OruParser, Hl7v2LabImportService,
  ],
  exports: [ImportService, Hl7v2LabImportService],
})
export class EhrImportModule {}