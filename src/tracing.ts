import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';

export function initTracing() {
  const tracingEnabled = process.env.OTEL_TRACING_ENABLED !== 'false';
  
  if (!tracingEnabled) {
    console.log('OpenTelemetry tracing is disabled');
    return null;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || 'healthy-stellar-backend';
  const serviceVersion = process.env.npm_package_version || '1.0.0';
  const environment = process.env.NODE_ENV || 'development';
  const samplingRate = parseFloat(process.env.OTEL_SAMPLING_RATE || '1.0');
  
  // Configure OTLP exporter
  const otlpExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    headers: {},
  });

  // Create resource with service information
  const resource = Resource.default().merge(
    new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      'deployment.environment': environment,
      'service.namespace': 'healthcare',
    }),
  );

  // Initialize SDK with auto-instrumentations
  const sdk = new NodeSDK({
    resource,
    spanProcessor: new BatchSpanProcessor(otlpExporter),
    sampler: new TraceIdRatioBasedSampler(samplingRate),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable fs instrumentation to reduce noise
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingRequestHook: (req) => {
            // Ignore health check and metrics endpoints
            const url = req.url || '';
            return url.includes('/health') || url.includes('/metrics');
          },
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
          enhancedDatabaseReporting: true,
        },
        '@opentelemetry/instrumentation-ioredis': {
          enabled: true,
        },
      }),
    ],
  });

  // Start the SDK
  sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.error('Error terminating tracing', error))
      .finally(() => process.exit(0));
  });

  console.log(`OpenTelemetry tracing initialized for ${serviceName} (sampling: ${samplingRate * 100}%)`);

  return sdk;
}
