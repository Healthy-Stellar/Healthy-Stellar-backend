# Prometheus Metrics Implementation

## Overview

This document describes the Prometheus metrics implementation for the Healthy Stellar backend application. Application-level metrics are exposed via a protected `/metrics` endpoint for monitoring system health, detecting anomalies, and setting up alerting.

## Features

- **Prometheus Integration**: Using `@willsoto/nestjs-prometheus` for seamless NestJS integration
- **Protected Endpoint**: `/metrics` endpoint secured with token authentication and network restrictions
- **Custom Metrics**: Application-specific metrics for medical records, Stellar transactions, IPFS uploads, etc.
- **Default Metrics**: Node.js process and HTTP metrics included automatically
- **Grafana Dashboard**: Pre-built dashboard for visualizing all metrics
- **Alerting Rules**: Prometheus alert rules for critical conditions

## Metrics Endpoint

### Access

**URL**: `GET /metrics`

**Authentication**: One of the following:
1. Request from internal network (127.0.0.1, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
2. Valid `X-Metrics-Token` header

**Response Format**: Prometheus text format (text/plain)

### Configuration

```env
# Metrics authentication token
METRICS_TOKEN=your_secure_token_here

# Allowed networks (comma-separated, supports CIDR)
METRICS_ALLOWED_NETWORKS=127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

### Example Request

```bash
# From internal network
curl http://localhost:3000/metrics

# From external network with token
curl -H "X-Metrics-Token: your_token" http://api.example.com/metrics
```

## Custom Metrics

### 1. Records Uploaded Counter

**Name**: `medchain_records_uploaded_total`  
**Type**: Counter  
**Labels**: `tenant`, `record_type`  
**Description**: Total number of medical records uploaded

```typescript
// Usage
customMetricsService.recordUpload('hospital-a', 'patient');
```

**Example Output**:
```
medchain_records_uploaded_total{tenant="hospital-a",record_type="patient"} 1234
medchain_records_uploaded_total{tenant="hospital-b",record_type="lab_result"} 567
```

### 2. Stellar Transaction Duration Histogram

**Name**: `medchain_stellar_tx_duration_seconds`  
**Type**: Histogram  
**Labels**: `operation`  
**Buckets**: [0.1, 0.5, 1, 2, 5, 10]  
**Description**: Duration of Stellar blockchain transactions in seconds

```typescript
// Usage
customMetricsService.recordStellarTransaction('anchor_record', 1.23);

// Or use timing helper
await customMetricsService.timeStellarOperation('anchor_record', async () => {
  return await stellarService.anchorRecord(data);
});
```

**Example Output**:
```
medchain_stellar_tx_duration_seconds_bucket{operation="anchor_record",le="0.5"} 45
medchain_stellar_tx_duration_seconds_bucket{operation="anchor_record",le="1"} 120
medchain_stellar_tx_duration_seconds_sum{operation="anchor_record"} 234.5
medchain_stellar_tx_duration_seconds_count{operation="anchor_record"} 200
```

### 3. IPFS Upload Duration Histogram

**Name**: `medchain_ipfs_upload_duration_seconds`  
**Type**: Histogram  
**Buckets**: [0.1, 0.5, 1, 2, 5, 10, 30]  
**Description**: Duration of IPFS uploads in seconds

```typescript
// Usage
customMetricsService.recordIpfsUpload(2.45);

// Or use timing helper
await customMetricsService.timeIpfsOperation(async () => {
  return await ipfsService.upload(file);
});
```

### 4. Active Access Grants Gauge

**Name**: `medchain_access_grants_active`  
**Type**: Gauge  
**Labels**: `tenant`  
**Description**: Number of currently active access grants

```typescript
// Usage
customMetricsService.setAccessGrantsActive('hospital-a', 150);
```

**Example Output**:
```
medchain_access_grants_active{tenant="hospital-a"} 150
medchain_access_grants_active{tenant="hospital-b"} 89
```

### 5. Job Queue Depth Gauge

**Name**: `medchain_job_queue_depth`  
**Type**: Gauge  
**Labels**: `queue_name`  
**Description**: Current depth of job queues

```typescript
// Usage
customMetricsService.setJobQueueDepth('record-processing', 42);
```

**Example Output**:
```
medchain_job_queue_depth{queue_name="record-processing"} 42
medchain_job_queue_depth{queue_name="stellar-sync"} 15
```

### 6. FHIR Requests Counter

**Name**: `medchain_fhir_requests_total`  
**Type**: Counter  
**Labels**: `resource_type`, `status`  
**Description**: Total number of FHIR API requests

```typescript
// Usage
customMetricsService.recordFhirRequest('Patient', 'success');
customMetricsService.recordFhirRequest('Observation', 'error');
```

**Example Output**:
```
medchain_fhir_requests_total{resource_type="Patient",status="success"} 5678
medchain_fhir_requests_total{resource_type="Observation",status="success"} 12345
medchain_fhir_requests_total{resource_type="Patient",status="error"} 23
```

## Default Metrics

The following Node.js and process metrics are automatically collected:

- `process_cpu_seconds_total` - Total CPU time
- `process_resident_memory_bytes` - Resident memory size
- `process_heap_bytes` - Heap memory size
- `nodejs_eventloop_lag_seconds` - Event loop lag
- `nodejs_active_handles_total` - Active handles
- `nodejs_active_requests_total` - Active requests
- `http_requests_total` - HTTP request count
- `http_request_duration_seconds` - HTTP request duration

## Integration Examples

### In a Service

```typescript
import { Injectable } from '@nestjs/common';
import { CustomMetricsService } from '../metrics/custom-metrics.service';

@Injectable()
export class RecordsService {
  constructor(
    private readonly metricsService: CustomMetricsService,
  ) {}

  async uploadRecord(tenant: string, record: any) {
    // Upload logic...
    
    // Record metric
    this.metricsService.recordUpload(tenant, record.type);
    
    return result;
  }
}
```

### In Stellar Service

```typescript
import { Injectable } from '@nestjs/common';
import { CustomMetricsService } from '../metrics/custom-metrics.service';

@Injectable()
export class StellarService {
  constructor(
    private readonly metricsService: CustomMetricsService,
  ) {}

  async anchorRecord(data: any) {
    // Use timing helper
    return await this.metricsService.timeStellarOperation(
      'anchor_record',
      async () => {
        // Stellar transaction logic...
        return result;
      }
    );
  }
}
```

### In Queue Consumer

```typescript
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { CustomMetricsService } from '../metrics/custom-metrics.service';

@Processor('record-processing')
export class RecordProcessor {
  constructor(
    private readonly metricsService: CustomMetricsService,
  ) {}

  @Process()
  async processRecord(job: Job) {
    // Update queue depth
    const queueDepth = await this.getQueueDepth();
    this.metricsService.setJobQueueDepth('record-processing', queueDepth);
    
    // Process job...
  }
}
```

## Prometheus Configuration

The Prometheus scrape configuration is located at `docker/monitoring/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'medical-app'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

## Alert Rules

Alert rules are defined in `docker/monitoring/app-alerts.yml`:

### 1. High Error Rate
- **Condition**: Error rate > 5%
- **Duration**: 5 minutes
- **Severity**: Critical

### 2. High Queue Depth
- **Condition**: Queue depth > 500
- **Duration**: 5 minutes
- **Severity**: Warning

### 3. High Stellar RPC Latency
- **Condition**: P95 latency > 2 seconds
- **Duration**: 5 minutes
- **Severity**: Warning

### 4. High IPFS Upload Latency
- **Condition**: P95 latency > 10 seconds
- **Duration**: 5 minutes
- **Severity**: Warning

### 5. Application Down
- **Condition**: Application unreachable
- **Duration**: 1 minute
- **Severity**: Critical

### 6. High Memory Usage
- **Condition**: Memory > 2GB
- **Duration**: 5 minutes
- **Severity**: Warning

### 7. High CPU Usage
- **Condition**: CPU > 80%
- **Duration**: 5 minutes
- **Severity**: Warning

### 8. High FHIR Error Rate
- **Condition**: FHIR error rate > 5%
- **Duration**: 5 minutes
- **Severity**: Warning

## Grafana Dashboard

Import the dashboard from `docker/monitoring/grafana/dashboards/app-metrics.json`.

### Dashboard Panels

1. **Records Upload Rate by Tenant** - Line chart showing upload rate per tenant
2. **Job Queue Depth** - Gauge showing current queue depth with thresholds
3. **Stellar Transaction Duration** - Line chart with P50, P95, P99 percentiles
4. **IPFS Upload Duration** - Line chart with P50, P95, P99 percentiles
5. **Active Access Grants by Tenant** - Line chart showing active grants
6. **FHIR Requests by Resource Type** - Line chart showing request rates
7. **Error Rate** - Gauge showing current error percentage
8. **Total Records Uploaded** - Stat panel showing cumulative count
9. **Memory Usage** - Stat panel showing current memory
10. **CPU Usage** - Gauge showing current CPU percentage

## Querying Metrics

### PromQL Examples

**Error rate over last 5 minutes**:
```promql
(sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100
```

**P95 Stellar transaction latency**:
```promql
histogram_quantile(0.95, sum(rate(medchain_stellar_tx_duration_seconds_bucket[5m])) by (le, operation))
```

**Records uploaded per hour**:
```promql
increase(medchain_records_uploaded_total[1h])
```

**Average queue depth**:
```promql
avg(medchain_job_queue_depth) by (queue_name)
```

**FHIR success rate**:
```promql
(sum(rate(medchain_fhir_requests_total{status="success"}[5m])) / sum(rate(medchain_fhir_requests_total[5m]))) * 100
```

## Security Considerations

1. **Token Protection**: Store `METRICS_TOKEN` securely, never commit to version control
2. **Network Restrictions**: Limit access to internal networks only in production
3. **No Sensitive Data**: Metrics should never contain PHI or PII
4. **Rate Limiting**: Consider rate limiting the metrics endpoint
5. **Monitoring**: Monitor access to the metrics endpoint itself

## Best Practices

1. **Label Cardinality**: Keep label values bounded to avoid cardinality explosion
2. **Metric Naming**: Follow Prometheus naming conventions (snake_case, descriptive)
3. **Units**: Include units in metric names (e.g., `_seconds`, `_bytes`, `_total`)
4. **Histograms**: Choose bucket boundaries based on expected values
5. **Gauges**: Update gauges regularly to reflect current state
6. **Counters**: Only increment, never decrement counters

## Troubleshooting

### Metrics endpoint returns 401

Check that:
1. `METRICS_TOKEN` is set in environment
2. Request includes `X-Metrics-Token` header
3. Token matches the configured value

### Metrics endpoint returns 403

Check that:
1. Request is from allowed network
2. `METRICS_ALLOWED_NETWORKS` includes your IP/network
3. Proxy headers are correctly forwarded

### Metrics not appearing in Prometheus

Check that:
1. Prometheus can reach the application
2. Scrape configuration is correct
3. Application is running and healthy
4. Firewall allows Prometheus to connect

### High cardinality warnings

Check that:
1. Label values are bounded (not user IDs, timestamps, etc.)
2. Labels represent dimensions, not values
3. Consider aggregating high-cardinality data

## Performance Impact

- **Overhead**: <1ms per metric operation
- **Memory**: ~100KB per 1000 time series
- **CPU**: Negligible for typical workloads
- **Network**: ~10KB per scrape (depends on metric count)

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [@willsoto/nestjs-prometheus](https://github.com/willsoto/nestjs-prometheus)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [Grafana Documentation](https://grafana.com/docs/)
