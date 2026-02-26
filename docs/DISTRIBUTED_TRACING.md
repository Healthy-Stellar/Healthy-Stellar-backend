# Distributed Tracing with OpenTelemetry

This document describes the distributed tracing implementation for the Healthy Stellar backend using OpenTelemetry.

## Overview

Distributed tracing has been implemented to provide end-to-end visibility across:
- HTTP requests and responses
- Database queries (PostgreSQL)
- Redis operations
- BullMQ job processing
- Stellar blockchain RPC calls
- IPFS operations
- FHIR resource transformations

## Architecture

### Components

1. **OpenTelemetry SDK** (`src/tracing.ts`)
   - Initializes tracing before application bootstrap
   - Configures auto-instrumentation for HTTP, PostgreSQL, Redis
   - Exports traces to OTLP-compatible collectors (Jaeger, etc.)

2. **TracingService** (`src/common/services/tracing.service.ts`)
   - Utility service for creating custom spans
   - Provides methods for adding attributes, events, and exceptions
   - Accessible throughout the application via dependency injection

3. **TracingInterceptor** (`src/common/interceptors/tracing.interceptor.ts`)
   - Adds `X-Trace-ID` header to all HTTP responses
   - Attaches trace ID to request object for logging

4. **Custom Instrumentation**
   - **StellarService**: Traces blockchain operations with network details
   - **IpfsService**: Traces file uploads with buffer size and CID
   - **FhirMapperService**: Traces FHIR resource transformations
   - **QueueService**: Propagates trace context across job boundaries
   - **Job Processors**: Extract and continue traces from job data

## Configuration

### Environment Variables

```bash
# Service identification
OTEL_SERVICE_NAME=healthy-stellar-backend

# OTLP Exporter endpoint
# Development (Jaeger): http://localhost:4318/v1/traces
# Production: Your OTLP collector endpoint
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces

# Sampling rate (0.0 to 1.0)
# Development: 1.0 (100% - trace everything)
# Production: 0.1 (10% - sample 10% of requests)
OTEL_SAMPLING_RATE=1.0

# Enable/disable tracing
OTEL_TRACING_ENABLED=true
```

### Sampling Strategy

- **Development**: 100% sampling (`OTEL_SAMPLING_RATE=1.0`)
- **Production**: 10% sampling (`OTEL_SAMPLING_RATE=0.1`) to reduce overhead

## Local Development with Jaeger

### Starting Jaeger

```bash
# Start all development services including Jaeger
docker-compose -f docker-compose.dev.yml up -d

# Jaeger UI will be available at:
# http://localhost:16686
```

### Jaeger Ports

- **16686**: Jaeger UI
- **4318**: OTLP HTTP endpoint (used by the application)
- **4317**: OTLP gRPC endpoint
- **14268**: Jaeger collector HTTP
- **9411**: Zipkin compatible endpoint

## Using Traces

### Viewing Traces in Jaeger

1. Open http://localhost:16686
2. Select service: `healthy-stellar-backend`
3. Click "Find Traces"
4. Click on a trace to see the full span tree

### Trace Context Propagation

Traces are automatically propagated across:

1. **HTTP Requests**: Via standard W3C trace context headers
2. **BullMQ Jobs**: Via `traceContext` field in job data
3. **Database Queries**: Via auto-instrumentation
4. **Redis Operations**: Via auto-instrumentation

### Custom Spans

Use `TracingService` to create custom spans:

```typescript
import { TracingService } from '../common/services/tracing.service';

@Injectable()
export class MyService {
  constructor(private readonly tracingService: TracingService) {}

  async myOperation() {
    return this.tracingService.withSpan(
      'my.operation',
      async (span) => {
        // Add custom attributes
        span.setAttribute('operation.type', 'custom');
        
        // Add events
        this.tracingService.addEvent('operation.started');
        
        // Your business logic
        const result = await this.doWork();
        
        this.tracingService.addEvent('operation.completed');
        return result;
      },
    );
  }
}
```

## Trace ID in Logs

All logs include the trace ID for correlation:

```
[StellarService][traceId: 5f9c8d7e6b4a3c2d1e0f9a8b] CID anchored on Stellar: abc123
```

## Trace ID in HTTP Responses

Every HTTP response includes the `X-Trace-ID` header:

```
X-Trace-ID: 5f9c8d7e6b4a3c2d1e0f9a8b
```

This allows clients to reference specific traces when reporting issues.

## Production Deployment

### OTLP Collector Options

1. **Jaeger**: Self-hosted or managed
2. **Grafana Tempo**: Open-source, S3-backed
3. **AWS X-Ray**: Via OTLP exporter
4. **Datadog**: Via OTLP exporter
5. **New Relic**: Via OTLP exporter
6. **Honeycomb**: Via OTLP exporter

### Example: Grafana Tempo

```yaml
# docker-compose.prod.yml
tempo:
  image: grafana/tempo:latest
  command: ["-config.file=/etc/tempo.yaml"]
  volumes:
    - ./tempo.yaml:/etc/tempo.yaml
    - tempo-data:/tmp/tempo
  ports:
    - "4318:4318"  # OTLP HTTP
```

### Performance Considerations

1. **Sampling**: Use 10% sampling in production (`OTEL_SAMPLING_RATE=0.1`)
2. **Batch Processing**: Spans are batched before export (configured in SDK)
3. **Resource Limits**: Monitor collector resource usage
4. **Retention**: Configure appropriate trace retention policies

## Instrumented Operations

### Automatic Instrumentation

- ✅ HTTP requests/responses
- ✅ PostgreSQL queries
- ✅ Redis operations
- ✅ IORedis operations

### Custom Instrumentation

- ✅ Stellar blockchain operations
  - Account loading
  - Transaction building
  - Transaction submission
- ✅ IPFS operations
  - File uploads with buffer size
- ✅ FHIR transformations
  - Patient mapping
  - DocumentReference mapping
  - Consent mapping
  - Provenance mapping
- ✅ BullMQ job processing
  - Job dispatch with trace context
  - Job processing with trace continuation

## Troubleshooting

### Traces Not Appearing

1. Check OTLP endpoint is accessible:
   ```bash
   curl http://localhost:4318/v1/traces
   ```

2. Verify environment variables are set:
   ```bash
   echo $OTEL_EXPORTER_OTLP_ENDPOINT
   echo $OTEL_SAMPLING_RATE
   ```

3. Check application logs for tracing initialization:
   ```
   OpenTelemetry tracing initialized for healthy-stellar-backend (sampling: 100%)
   ```

### High Overhead

1. Reduce sampling rate: `OTEL_SAMPLING_RATE=0.1`
2. Disable file system instrumentation (already disabled)
3. Filter out health check endpoints (already configured)

### Missing Trace Context in Jobs

Ensure job data includes `traceContext`:

```typescript
const enrichedJobData = {
  ...jobData,
  traceContext,
  traceId: this.tracingService.getCurrentTraceId(),
};
```

## Best Practices

1. **Meaningful Span Names**: Use hierarchical naming (e.g., `stellar.anchorCid`, `fhir.mapper.toPatient`)
2. **Add Context**: Include relevant attributes (patient ID, operation type, etc.)
3. **Record Events**: Mark important milestones within spans
4. **Handle Errors**: Always record exceptions in spans
5. **Avoid PII**: Don't include sensitive patient data in span attributes

## Metrics and Monitoring

Consider adding these metrics alongside tracing:

- Request latency percentiles (p50, p95, p99)
- Error rates by operation type
- Stellar transaction success/failure rates
- IPFS upload latency
- Queue processing time

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
