import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportJob } from './entities/report-job.entity';
import { ReportSchedule } from './entities/report-schedule.entity';
import { ReportsService } from './reports.service';
import { ReportScheduleService } from './report-schedule.service';
import { ReportsController } from './reports.controller';
import { ReportScheduleController } from './report-schedule.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReportJob, ReportSchedule]),
    ScheduleModule.forRoot(),
    NotificationsModule,
  ],
  controllers: [ReportsController, ReportScheduleController],
  providers: [ReportsService, ReportScheduleService],
  exports: [ReportsService, ReportScheduleService],
})
export class ReportsModule {}
