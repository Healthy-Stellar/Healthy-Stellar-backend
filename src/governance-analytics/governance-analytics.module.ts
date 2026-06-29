import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { GovernanceSnapshot } from './entities/governance-snapshot.entity';
import { ComplianceReportJob } from './entities/compliance-report-job.entity';
import { AuditLogEntity } from '../common/audit/audit-log.entity';
import { User } from '../auth/entities/user.entity';
import { ComplianceReportsService } from './services/compliance-reports.service';
import { ComplianceReportProcessor } from './processors/compliance-report.processor';
import { ComplianceReportsController } from './controllers/compliance-reports.controller';
import { MonthlyComplianceReportTask } from './tasks/monthly-compliance-report.task';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { AuditModule } from '../common/audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GovernanceSnapshot, ComplianceReportJob, AuditLogEntity, User]),
    BullModule.registerQueue({ name: QUEUE_NAMES.COMPLIANCE_REPORTS }),
    AuditModule,
    NotificationsModule,
  ],
  controllers: [ComplianceReportsController],
  providers: [ComplianceReportsService, ComplianceReportProcessor, MonthlyComplianceReportTask],
  exports: [ComplianceReportsService],
})
export class GovernanceAnalyticsModule {}
