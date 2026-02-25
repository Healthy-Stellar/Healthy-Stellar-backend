import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import {
  CustomMetricsService,
  RecordsUploadedCounter,
  StellarTxDurationHistogram,
  IpfsUploadDurationHistogram,
  AccessGrantsActiveGauge,
  JobQueueDepthGauge,
  FhirRequestsCounter,
} from './custom-metrics.service';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'medchain_',
        },
      },
      path: '/metrics',
      defaultLabels: {
        app: 'healthy-stellar-backend',
        environment: process.env.NODE_ENV || 'development',
      },
    }),
  ],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    CustomMetricsService,
    RecordsUploadedCounter,
    StellarTxDurationHistogram,
    IpfsUploadDurationHistogram,
    AccessGrantsActiveGauge,
    JobQueueDepthGauge,
    FhirRequestsCounter,
  ],
  exports: [CustomMetricsService],
})
export class MetricsModule {}
