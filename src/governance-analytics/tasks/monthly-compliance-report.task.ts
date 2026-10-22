import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../auth/entities/user.entity';
import { ComplianceReportType } from '../entities/compliance-report-job.entity';
import { ComplianceReportsService } from '../services/compliance-reports.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

const REPORT_TYPES = [ComplianceReportType.HIPAA, ComplianceReportType.GDPR, ComplianceReportType.SOC2];

/** Generates last month's compliance reports and emails every compliance officer. */
@Injectable()
export class MonthlyComplianceReportTask {
  private readonly logger = new Logger(MonthlyComplianceReportTask.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly complianceReportsService: ComplianceReportsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async generateMonthlyReports(): Promise<void> {
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const officers = await this.userRepository.find({ where: { role: UserRole.COMPLIANCE_OFFICER } });
    if (officers.length === 0) {
      this.logger.log('No compliance officers configured; skipping monthly report email');
    }

    for (const reportType of REPORT_TYPES) {
      const { jobId } = await this.complianceReportsService.requestReport(
        {
          reportType,
          startDate: startOfLastMonth.toISOString().slice(0, 10),
          endDate: endOfLastMonth.toISOString().slice(0, 10),
        },
        undefined,
      );

      this.logger.log(`Queued monthly ${reportType} compliance report: ${jobId}`);

      for (const officer of officers) {
        await this.notificationsService.sendEmail(
          officer.email,
          `Monthly ${reportType} compliance report is being generated`,
          'compliance-report-ready',
          { reportType, jobId, period: { start: startOfLastMonth, end: endOfLastMonth } },
        );
      }
    }
  }
}
