import { Test, TestingModule } from '@nestjs/testing';
import { CustomMetricsService } from './custom-metrics.service';
import { Counter, Histogram, Gauge } from 'prom-client';

function makeCounter() {
  return { inc: jest.fn() } as unknown as jest.Mocked<Counter<string>>;
}
function makeHistogram() {
  return { observe: jest.fn() } as unknown as jest.Mocked<Histogram<string>>;
}
function makeGauge() {
  return { set: jest.fn() } as unknown as jest.Mocked<Gauge<string>>;
}

describe('CustomMetricsService — new metrics', () => {
  let service: CustomMetricsService;

  // New metric mocks
  const httpRequestsTotalCounter = makeCounter();
  const httpRequestDurationHistogram = makeHistogram();
  const dbQueryDurationHistogram = makeHistogram();
  const blockchainTxTotalCounter = makeCounter();
  const ipfsUploadDurationSecondsHistogram = makeHistogram();
  const queueDepthGauge = makeGauge();
  const activePatientsGauge = makeGauge();
  const activeProvidersGauge = makeGauge();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomMetricsService,
        // Existing (stubs)
        { provide: 'PROM_METRIC_MEDCHAIN_RECORDS_UPLOADED_TOTAL', useValue: makeCounter() },
        { provide: 'PROM_METRIC_MEDCHAIN_STELLAR_TX_DURATION_SECONDS', useValue: makeHistogram() },
        { provide: 'PROM_METRIC_MEDCHAIN_IPFS_UPLOAD_DURATION_SECONDS', useValue: makeHistogram() },
        { provide: 'PROM_METRIC_MEDCHAIN_ACCESS_GRANTS_ACTIVE', useValue: makeGauge() },
        { provide: 'PROM_METRIC_MEDCHAIN_JOB_QUEUE_DEPTH', useValue: makeGauge() },
        { provide: 'PROM_METRIC_MEDCHAIN_FHIR_REQUESTS_TOTAL', useValue: makeCounter() },
        // New
        { provide: 'PROM_METRIC_HTTP_REQUESTS_TOTAL', useValue: httpRequestsTotalCounter },
        { provide: 'PROM_METRIC_HTTP_REQUEST_DURATION_SECONDS', useValue: httpRequestDurationHistogram },
        { provide: 'PROM_METRIC_DB_QUERY_DURATION_SECONDS', useValue: dbQueryDurationHistogram },
        { provide: 'PROM_METRIC_BLOCKCHAIN_TX_TOTAL', useValue: blockchainTxTotalCounter },
        { provide: 'PROM_METRIC_IPFS_UPLOAD_DURATION_SECONDS', useValue: ipfsUploadDurationSecondsHistogram },
        { provide: 'PROM_METRIC_QUEUE_DEPTH', useValue: queueDepthGauge },
        { provide: 'PROM_METRIC_ACTIVE_PATIENTS_TOTAL', useValue: activePatientsGauge },
        { provide: 'PROM_METRIC_ACTIVE_PROVIDERS_TOTAL', useValue: activeProvidersGauge },
      ],
    }).compile();

    service = module.get<CustomMetricsService>(CustomMetricsService);
  });

  describe('recordHttpRequest', () => {
    it('increments http_requests_total with correct labels', () => {
      service.recordHttpRequest('GET', '/patients', 200, 0.05);
      expect(httpRequestsTotalCounter.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '/patients',
        status: '200',
      });
    });

    it('observes http_request_duration_seconds', () => {
      service.recordHttpRequest('POST', '/records', 201, 0.12);
      expect(httpRequestDurationHistogram.observe).toHaveBeenCalledWith(
        { method: 'POST', route: '/records', status: '201' },
        0.12,
      );
    });

    it('records 5xx status correctly', () => {
      service.recordHttpRequest('GET', '/health', 500, 0.001);
      expect(httpRequestsTotalCounter.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '/health',
        status: '500',
      });
    });
  });

  describe('recordDbQuery', () => {
    it('observes db_query_duration_seconds with query_type and entity labels', () => {
      service.recordDbQuery('select', 'Patient', 0.003);
      expect(dbQueryDurationHistogram.observe).toHaveBeenCalledWith(
        { query_type: 'select', entity: 'Patient' },
        0.003,
      );
    });
  });

  describe('recordBlockchainTx', () => {
    it('increments blockchain_tx_total with status=success', () => {
      service.recordBlockchainTx('success');
      expect(blockchainTxTotalCounter.inc).toHaveBeenCalledWith({ status: 'success' });
    });

    it('increments blockchain_tx_total with status=failure', () => {
      service.recordBlockchainTx('failure');
      expect(blockchainTxTotalCounter.inc).toHaveBeenCalledWith({ status: 'failure' });
    });
  });

  describe('recordIpfsUploadDuration', () => {
    it('observes ipfs_upload_duration_seconds', () => {
      service.recordIpfsUploadDuration(2.5);
      expect(ipfsUploadDurationSecondsHistogram.observe).toHaveBeenCalledWith(2.5);
    });
  });

  describe('setQueueDepth', () => {
    it('sets queue_depth gauge with queue label', () => {
      service.setQueueDepth('stellar-transactions', 42);
      expect(queueDepthGauge.set).toHaveBeenCalledWith({ queue: 'stellar-transactions' }, 42);
    });
  });

  describe('setActivePatients', () => {
    it('sets active_patients_total gauge', () => {
      service.setActivePatients(150);
      expect(activePatientsGauge.set).toHaveBeenCalledWith(150);
    });
  });

  describe('setActiveProviders', () => {
    it('sets active_providers_total gauge', () => {
      service.setActiveProviders(30);
      expect(activeProvidersGauge.set).toHaveBeenCalledWith(30);
    });
  });
});
