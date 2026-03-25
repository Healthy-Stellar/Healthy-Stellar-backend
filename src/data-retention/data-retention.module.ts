import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Record } from '../records/entities/record.entity';
import { AuditLogService } from '../common/audit/audit-log.service';
import { AuditLogEntity } from '../common/audit/audit-log.entity';
import { DataRetentionService } from './data-retention.service';

@Module({
  imports: [TypeOrmModule.forFeature([Record, AuditLogEntity])],
  providers: [DataRetentionService, AuditLogService],
  exports: [DataRetentionService],
})
export class DataRetentionModule {}
