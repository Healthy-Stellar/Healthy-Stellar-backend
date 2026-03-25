import { Injectable } from '@nestjs/common';
import {
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
  InjectMetric,
} from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';

// ── Existing metrics ──────────────────────────────────────────────────────────

export const RecordsUploadedCounter = makeCounterProvider({
  name: 'medchain_records_uploaded_total',
  help: 'Total number of medical records uploaded',
  labelNames: ['tenant', 'record_type'],
});

export const StellarTxDurationHistogram = makeHistogramProvider({
  name: 'medchain_stellar_tx_duration_seconds',
  help: 'Duration of Stellar blockchain transactions in seconds',
  labelNames: ['operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const IpfsUploadDurationHistogram = makeHistogramProvider({
  name: 'medchain_ipfs_upload_duration_seconds',
  help: 'Duration of IPFS uploads in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

export const AccessGrantsActiveGauge = makeGaugeProvider({
  name: 'medchain_access_grants_active',
  help: 'Number of currently active access grants',
  labelNames: ['tenant'],
});

export const JobQueueDepthGauge = makeGaugeProvider({
  name: 'medchain_job_queue_depth',
  help: 'Current depth of job queues',
  labelNames: ['queue_name'],
});

export const FhirRequestsCounter = makeCounterProvider({
  name: 'medchain_fhir_requests_total',
  help: 'Total number of FHIR API requests',
  labelNames: ['resource_type', 'status'],
});

// ── New required metrics ──────────────────────────────────────────────────────

/** http_requests_total — counter by method, route, status */
export const HttpRequestsTotalCounter = makeCounterProvider({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

/** http_request_duration_seconds — histogram */
export const HttpRequestDurationHistogram = makeHistogramProvider({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

/** db_query_duration_seconds — histogram */
export const DbQueryDurationHistogram = makeHistogramProvider({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'entity'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});

/** blockchain_tx_total — counter by status */
export const BlockchainTxTotalCounter = makeCounterProvider({
  name: 'blockchain_tx_total',
  help: 'Total number of blockchain transactions',
  labelNames: ['status'],
});

/** ipfs_upload_duration_seconds — histogram (dedicated, no labels) */
export const IpfsUploadDurationSecondsHistogram = makeHistogramProvider({
  name: 'ipfs_upload_duration_seconds',
  help: 'Duration of IPFS upload operations in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

/** queue_depth — gauge per BullMQ queue */
export const QueueDepthGauge = makeGaugeProvider({
  name: 'queue_depth',
  help: 'Current number of waiting jobs per BullMQ queue',
  labelNames: ['queue'],
});

/** active_patients_total — gauge */
export const ActivePatientsTotalGauge = makeGaugeProvider({
  name: 'active_patients_total',
  help: 'Total number of active patients',
});

/** active_providers_total — gauge */
export const ActiveProvidersTotalGauge = makeGaugeProvider({
  name: 'active_providers_total',
  help: 'Total number of active providers',
});

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CustomMetricsService {
  constructor(
    // Existing
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

    // New
    @InjectMetric('http_requests_total')
    public httpRequestsTotalCounter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    public httpRequestDurationHistogram: Histogram<string>,
    @InjectMetric('db_query_duration_seconds')
    public dbQueryDurationHistogram: Histogram<string>,
    @InjectMetric('blockchain_tx_total')
    public blockchainTxTotalCounter: Counter<string>,
    @InjectMetric('ipfs_upload_duration_seconds')
    public ipfsUploadDurationSecondsHistogram: Histogram<string>,
    @InjectMetric('queue_depth')
    public queueDepthGauge: Gauge<string>,
    @InjectMetric('active_patients_total')
    public activePatientsGauge: Gauge<string>,
    @InjectMetric('active_providers_total')
    public activeProvidersGauge: Gauge<string>,
  ) {}

  // ── Existing helpers ────────────────────────────────────────────────────────

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

  async timeStellarOperation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.recordStellarTransaction(operation, (Date.now() - start) / 1000);
      return result;
    } catch (error) {
      this.recordStellarTransaction(operation, (Date.now() - start) / 1000);
      throw error;
    }
  }

  async timeIpfsOperation<T>(fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.recordIpfsUpload((Date.now() - start) / 1000);
      return result;
    } catch (error) {
      this.recordIpfsUpload((Date.now() - start) / 1000);
      throw error;
    }
  }

  // ── New helpers ─────────────────────────────────────────────────────────────

  recordHttpRequest(method: string, route: string, status: number, durationSeconds: number) {
    const labels = { method, route, status: String(status) };
    this.httpRequestsTotalCounter.inc(labels);
    this.httpRequestDurationHistogram.observe(labels, durationSeconds);
  }

  recordDbQuery(queryType: string, entity: string, durationSeconds: number) {
    this.dbQueryDurationHistogram.observe({ query_type: queryType, entity }, durationSeconds);
  }

  recordBlockchainTx(status: 'success' | 'failure') {
    this.blockchainTxTotalCounter.inc({ status });
  }

  recordIpfsUploadDuration(durationSeconds: number) {
    this.ipfsUploadDurationSecondsHistogram.observe(durationSeconds);
  }

  setQueueDepth(queue: string, depth: number) {
    this.queueDepthGauge.set({ queue }, depth);
  }

  setActivePatients(count: number) {
    this.activePatientsGauge.set(count);
  }

  setActiveProviders(count: number) {
    this.activeProvidersGauge.set(count);
  }
}
