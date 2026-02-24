import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthcareAnalyticsService } from './healthcare-analytics.service';
import { ReportingOptimizationService } from './reporting-optimization.service';
import { AnalyticsSnapshot } from './entities/analytics-snapshot.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsSnapshot])],
  providers: [HealthcareAnalyticsService, ReportingOptimizationService],
  exports: [HealthcareAnalyticsService, ReportingOptimizationService],
})
export class HealthcareAnalyticsModule {}
