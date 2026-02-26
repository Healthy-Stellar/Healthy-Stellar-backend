# Distributed Tracing Quick Start

Get up and running with distributed tracing in 5 minutes.

## 1. Install Dependencies

```bash
npm install
```

The following OpenTelemetry packages are already added to `package.json`:
- `@opentelemetry/sdk-node`
- `@opentelemetry/auto-instrumentations-node`
- `@opentelemetry/exporter-trace-otlp-http`
- `@opentelemetry/instrumentation-*` (http, pg, ioredis, bullmq)

## 2. Start Jaeger

```bash
# Start Jaeger and other development services
docker-compose -f docker-compose.dev.yml up -d jaeger

# Verify Jaeger is running
curl http://localhost:16686
```

## 3. Configure Environment

Add to your `.env` file:

```bash
# OpenTelemetry Configuration
OTEL_SERVICE_NAME=healthy-stellar-backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTEL_SAMPLING_RATE=1.0
```

## 4. Start the Application

```bash
npm run start:dev
```

You should see:
```
OpenTelemetry tracing initialized for healthy-stellar-backend (sampling: 100%)
```

## 5. Generate Some Traces

Make a few API requests:

```bash
# Health check (not traced - filtered out)
curl http://localhost:3000/health

# API request (traced)
curl http://localhost:3000/api/patients

# Check the X-Trace-ID header
curl -I http://localhost:3000/api/patients
```

## 6. View Traces in Jaeger

1. Open http://localhost:16686
2. Select service: `healthy-stellar-backend`
3. Click "Find Traces"
4. Click on any trace to see details

## 7. Test Trace Propagation Across Jobs

```bash
# Dispatch a job that will be traced
curl -X POST http://localhost:3000/api/queue/stellar-transaction \
  -H "Content-Type: application/json" \
  -d '{
    "operationType": "anchorRecord",
    "params": {"patientId": "123", "cid": "abc"},
    "initiatedBy": "user-123",
    "correlationId": "test-123"
  }'
```

In Jaeger, you'll see:
- Parent span: HTTP POST request
- Child span: Queue dispatch
- Async span: Job processing (linked via trace context)

## What's Instrumented?

### Automatic
- ✅ HTTP requests/responses
- ✅ PostgreSQL queries
- ✅ Redis operations

### Custom
- ✅ Stellar blockchain calls
- ✅ IPFS uploads
- ✅ FHIR transformations
- ✅ BullMQ job processing

## Common Issues

### Traces not appearing?

Check the OTLP endpoint:
```bash
curl http://localhost:4318/v1/traces
```

### Jaeger not starting?

Check Docker logs:
```bash
docker logs healthy-stellar-jaeger
```

### Want to disable tracing?

Set in `.env`:
```bash
OTEL_SAMPLING_RATE=0.0
```

## Next Steps

- Read [DISTRIBUTED_TRACING.md](./DISTRIBUTED_TRACING.md) for detailed documentation
- Configure production OTLP collector
- Set up alerting on trace metrics
- Integrate with your monitoring stack

## Production Checklist

- [ ] Set `OTEL_SAMPLING_RATE=0.1` (10% sampling)
- [ ] Configure production OTLP endpoint
- [ ] Set up trace retention policies
- [ ] Monitor collector resource usage
- [ ] Configure alerting on error traces
- [ ] Document trace ID usage for support team
