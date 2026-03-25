import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import {
  CustomMetricsService,
  // Existing providers
  RecordsUploadedCounter,
  StellarTxDurationHistogram,
  IpfsUploadDurationHistogram,
  AccessGrantsActiveGauge,
  JobQueueDepthGauge,
  FhirRequestsCounter,
  // New providers
  HttpRequestsTotalCounter,
  HttpRequestDurationHistogram,
  DbQueryDurationHistogram,
  BlockchainTxTotalCounter,
  IpfsUploadDurationSecondsHistogram,
  QueueDepthGauge,
  ActivePatientsTotalGauge,
  ActiveProvidersTotalGauge,
} from './custom-metrics.service';
import { HttpMetricsInterceptor } from './interceptors/http-metrics.interceptor';
import { DbMetricsSubscriber } from './subscribers/db-metrics.subscriber';
import { QueueMetricsCollector } from './collectors/queue-metrics.collector';
import { PatientProviderMetricsCollector } from './collectors/patient-provider-metrics.collector';
import { Patient } from '../patients/entities/patient.entity';
import { QUEUE_NAMES } from '../queues/queue.constants';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
        config: { prefix: 'medchain_' },
      },
      path: '/metrics',
      defaultLabels: {
        app: 'healthy-stellar-backend',
        environment: process.env.NODE_ENV || 'development',
      },
    }),
    TypeOrmModule.forFeature([Patient]),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.STELLAR_TRANSACTIONS },
      { name: QUEUE_NAMES.IPFS_UPLOADS },
      { name: QUEUE_NAMES.EMAIL_NOTIFICATIONS },
      { name: QUEUE_NAMES.REPORTS },
    ),
  ],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    CustomMetricsService,
    // Existing metric providers
    RecordsUploadedCounter,
    StellarTxDurationHistogram,
    IpfsUploadDurationHistogram,
    AccessGrantsActiveGauge,
    JobQueueDepthGauge,
    FhirRequestsCounter,
    // New metric providers
    HttpRequestsTotalCounter,
    HttpRequestDurationHistogram,
    DbQueryDurationHistogram,
    BlockchainTxTotalCounter,
    IpfsUploadDurationSecondsHistogram,
    QueueDepthGauge,
    ActivePatientsTotalGauge,
    ActiveProvidersTotalGauge,
    // Interceptor, subscriber, collectors
    HttpMetricsInterceptor,
    DbMetricsSubscriber,
    QueueMetricsCollector,
    PatientProviderMetricsCollector,
  ],
  exports: [CustomMetricsService, HttpMetricsInterceptor],
})
export class MetricsModule {}
