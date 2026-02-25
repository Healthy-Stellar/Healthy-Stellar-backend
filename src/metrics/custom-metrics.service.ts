import { Injectable } from '@nestjs/common';
import {
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

// Counter for records uploaded
export const RecordsUploadedCounter = makeCounterProvider({
  name: 'medchain_records_uploaded_total',
  help: 'Total number of medical records uploaded',
  labelNames: ['tenant', 'record_type'],
});

// Histogram for Stellar transaction duration
export const StellarTxDurationHistogram = makeHistogramProvider({
  name: 'medchain_stellar_tx_duration_seconds',
  help: 'Duration of Stellar blockchain transactions in seconds',
  labelNames: ['operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Histogram for IPFS upload duration
export const IpfsUploadDurationHistogram = makeHistogramProvider({
  name: 'medchain_ipfs_upload_duration_seconds',
  help: 'Duration of IPFS uploads in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

// Gauge for active access grants
export const AccessGrantsActiveGauge = makeGaugeProvider({
  name: 'medchain_access_grants_active',
  help: 'Number of currently active access grants',
  labelNames: ['tenant'],
});

// Gauge for job queue depth
export const JobQueueDepthGauge = makeGaugeProvider({
  name: 'medchain_job_queue_depth',
  help: 'Current depth of job queues',
  labelNames: ['queue_name'],
});

// Counter for FHIR requests
export const FhirRequestsCounter = makeCounterProvider({
  name: 'medchain_fhir_requests_total',
  help: 'Total number of FHIR API requests',
  labelNames: ['resource_type', 'status'],
});

@Injectable()
export class CustomMetricsService {
  constructor(
    @InjectMetric('medchain_records_uploaded_total')
    public recordsUploadedCounter: Counter<string>,
    @InjectMetric('medchain_stellar_tx_duration_seconds')
    public stellarTxDurationHistogram: Histogram<string>,
    @InjectMetric('medchain_ipfs_upload_duration_seconds')
    public ipfsUploadDurationHistogram: Histogram<string>,
    @InjectMetric('medchain_access_grants_active')
    public accessGrantsActiveGauge: Gauge<string>,
    @InjectMetric('medchain_job_queue_depth')
    public jobQueueDepthGauge: Gauge<string>,
    @InjectMetric('medchain_fhir_requests_total')
    public fhirRequestsCounter: Counter<string>,
  ) {}

  // Helper methods for recording metrics

  recordUpload(tenant: string, recordType: string) {
    this.recordsUploadedCounter.inc({ tenant, record_type: recordType });
  }

  recordStellarTransaction(operation: string, durationSeconds: number) {
    this.stellarTxDurationHistogram.observe({ operation }, durationSeconds);
  }

  recordIpfsUpload(durationSeconds: number) {
    this.ipfsUploadDurationHistogram.observe(durationSeconds);
  }

  setAccessGrantsActive(tenant: string, count: number) {
    this.accessGrantsActiveGauge.set({ tenant }, count);
  }

  setJobQueueDepth(queueName: string, depth: number) {
    this.jobQueueDepthGauge.set({ queue_name: queueName }, depth);
  }

  recordFhirRequest(resourceType: string, status: string) {
    this.fhirRequestsCounter.inc({ resource_type: resourceType, status });
  }

  // Timing helper for Stellar operations
  async timeStellarOperation<T>(
    operation: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = (Date.now() - startTime) / 1000;
      this.recordStellarTransaction(operation, duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.recordStellarTransaction(operation, duration);
      throw error;
    }
  }

  // Timing helper for IPFS operations
  async timeIpfsOperation<T>(fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = (Date.now() - startTime) / 1000;
      this.recordIpfsUpload(duration);
      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.recordIpfsUpload(duration);
      throw error;
    }
  }
}
