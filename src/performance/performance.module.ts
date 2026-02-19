import { Module } from '@nestjs/common';
import { DatabaseOptimizationModule } from './database-optimization/database-optimization.module';
import { MedicalCacheModule } from './medical-cache/medical-cache.module';
import { WorkflowOptimizationModule } from './workflow-optimization/workflow-optimization.module';
import { HealthcareAnalyticsModule } from './healthcare-analytics/healthcare-analytics.module';
import { DeviceIntegrationModule } from './device-integration/device-integration.module';
import { LoadBalancingModule } from './load-balancing/load-balancing.module';

@Module({
  imports: [
    DatabaseOptimizationModule,
    MedicalCacheModule,
    WorkflowOptimizationModule,
    HealthcareAnalyticsModule,
    DeviceIntegrationModule,
    LoadBalancingModule,
  ],
  exports: [
    DatabaseOptimizationModule,
    MedicalCacheModule,
    WorkflowOptimizationModule,
    HealthcareAnalyticsModule,
    DeviceIntegrationModule,
    LoadBalancingModule,
  ],
})
export class PerformanceModule {}
