import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Record } from '../records/entities/record.entity';
import { AuditLogService } from '../common/audit/audit-log.service';
import { AuditLogEntity } from '../common/audit/audit-log.entity';
import { EventStoreModule } from '../event-store/event-store.module';
import { DataRetentionService } from './data-retention.service';
import { ArchivedRecordEntity } from './entities/archived-record.entity';
import { ArchiveService } from './services/archive.service';
import { RetentionPolicyRegistryService } from './services/retention-policy-registry.service';
import { RetentionEnforcementJob } from './jobs/retention-enforcement.job';

@Module({
  imports: [
    TypeOrmModule.forFeature([Record, AuditLogEntity, ArchivedRecordEntity]),
    EventStoreModule,
  ],
  providers: [
    DataRetentionService,
    AuditLogService,
    ArchiveService,
    RetentionPolicyRegistryService,
    RetentionEnforcementJob,
  ],
  exports: [DataRetentionService, RetentionPolicyRegistryService, RetentionEnforcementJob, ArchiveService],
})
export class DataRetentionModule {}
