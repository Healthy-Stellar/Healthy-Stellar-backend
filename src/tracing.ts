import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { TraceIdRatioBasedSampler, ParentBasedSampler } from '@opentelemetry/sdk-trace-base';

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

  // Configure OTLP exporter with retry logic
  const otlpExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : {},
    timeoutMillis: parseInt(process.env.OTEL_EXPORTER_OTLP_TIMEOUT || '10000', 10),
  });

  // Create resource with comprehensive service information
  const resource = Resource.default().merge(
    new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      'deployment.environment': environment,
      'service.namespace': 'healthcare',
      'service.instance.id': process.env.HOSTNAME || 'unknown',
      'process.pid': process.pid,
    }),
  );

  // Use parent-based sampler for better trace propagation
  const sampler = new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(samplingRate),
  });

  // Initialize SDK with auto-instrumentations
  const sdk = new NodeSDK({
    resource,
    traceExporter: otlpExporter,
    sampler,
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
          requestHook: (span, request) => {
            // Add custom attributes to HTTP spans
            span.setAttribute('http.client_ip', request.socket?.remoteAddress || 'unknown');
          },
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
          enhancedDatabaseReporting: true,
          responseHook: (span, response) => {
            // Add query result info
            if (response && typeof response === 'object') {
              span.setAttribute('db.rows_affected', (response as any).rowCount || 0);
            }
          },
        },
        '@opentelemetry/instrumentation-ioredis': {
          enabled: true,
          responseHook: (span, cmdName, cmdArgs, response) => {
            // Add Redis command details
            span.setAttribute('redis.command', cmdName);
            span.setAttribute('redis.args_count', Array.isArray(cmdArgs) ? cmdArgs.length : 0);
          },
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
  console.log(`OTLP Exporter: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'}`);

  return sdk;
}
