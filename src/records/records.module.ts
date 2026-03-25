import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Record } from './entities/record.entity';
import { RecordEvent } from './entities/record-event.entity';
import { RecordSnapshot } from './entities/record-snapshot.entity';
import { RecordTemplate } from './entities/record-template.entity';
import { RecordsController } from './controllers/records.controller';
import { RecordTemplateController } from './controllers/record-template.controller';
import { RecordsService } from './services/records.service';
import { RelatedRecordsService } from './services/related-records.service';
import { RecordTemplateService } from './services/record-template.service';
import { IpfsService } from './services/ipfs.service';
import { StellarService } from './services/stellar.service';
import { IpfsWithBreakerService } from './services/ipfs-with-breaker.service';
import { RecordEventStoreService } from './services/record-event-store.service';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { MedicalRbacModule } from '../roles/medical-rbac.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { AuditModule } from '../common/audit/audit.module';
import { RecordDownloadService } from './services/record-download.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Record, RecordEvent, RecordSnapshot, RecordTemplate]),
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
    CircuitBreakerModule,
    forwardRef(() => AccessControlModule),
    MedicalRbacModule,
    EncryptionModule,
    AuditModule,
  ],
  controllers: [RecordsController],
  providers: [RecordsService, RelatedRecordsService, IpfsService, StellarService, IpfsWithBreakerService, RecordEventStoreService],
  exports: [RecordsService, RelatedRecordsService, IpfsWithBreakerService, RecordEventStoreService],
  controllers: [RecordsController, RecordTemplateController],
  providers: [RecordsService, RecordTemplateService, IpfsService, StellarService, IpfsWithBreakerService, RecordEventStoreService, RecordDownloadService],
  exports: [RecordsService, RecordTemplateService, IpfsWithBreakerService, RecordEventStoreService, RecordDownloadService],
})
export class RecordsModule {}
