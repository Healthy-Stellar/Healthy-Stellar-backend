import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { Record } from './entities/record.entity';
import { RecordEvent } from './entities/record-event.entity';
import { RecordSnapshot } from './entities/record-snapshot.entity';
import { RecordTemplate } from './entities/record-template.entity';
import { RecordAttachment } from './entities/record-attachment.entity';
import { RecordsController } from './controllers/records.controller';
import { RecordTemplateController } from './controllers/record-template.controller';
import { RecordsService } from './services/records.service';
import { RelatedRecordsService } from './services/related-records.service';
import { RecordTemplateService } from './services/record-template.service';
import { IpfsService } from './services/ipfs.service';
import { StellarService } from './services/stellar.service';
import { IpfsWithBreakerService } from './services/ipfs-with-breaker.service';
import { RecordEventStoreService } from './services/record-event-store.service';
import { RecordSyncService } from './services/record-sync.service';
import { RecordVersionService } from './services/record-version.service';
import { RecordDiffService } from './services/record-diff.service';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { MedicalRbacModule } from '../roles/medical-rbac.module';
import { RecordAccessGuard } from './guards/record-access.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Record, RecordEvent, RecordSnapshot, RecordTemplate, RecordAttachment]),
    MulterModule.register({ limits: { fileSize: 50 * 1024 * 1024 } }),
    EventEmitterModule.forRoot(),
    ConfigModule,
    CircuitBreakerModule,
    forwardRef(() => AccessControlModule),
    MedicalRbacModule,
    EncryptionModule,
    AuditModule,
  ],
  controllers: [RecordsController, RecordTemplateController],
  providers: [
    RecordsService,
    RelatedRecordsService,
    RecordTemplateService,
    IpfsService,
    StellarService,
    IpfsWithBreakerService,
    RecordEventStoreService,
    RecordDownloadService,
    RecordAttachmentUploadService,
    RecordSyncService,
  ],
  exports: [
    RecordsService,
    RelatedRecordsService,
    RecordTemplateService,
    IpfsWithBreakerService,
    RecordEventStoreService,
    RecordDownloadService,
    RecordAttachmentUploadService,
    RecordSyncService,
  ],
  controllers: [RecordsController, RecordTemplateController],
  providers: [
    RecordsService,
    RecordTemplateService,
    IpfsService,
    StellarService,
    IpfsWithBreakerService,
    RecordEventStoreService,
    RecordAccessGuard,
  ],
  exports: [RecordsService, RecordTemplateService, IpfsWithBreakerService, RecordEventStoreService],
})
export class RecordsModule {}
