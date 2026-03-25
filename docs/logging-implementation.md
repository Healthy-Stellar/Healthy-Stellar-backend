# Structured Logging Implementation with Pino

## Overview

This document describes the structured JSON logging implementation using Pino for the Healthy Stellar backend application. All logs are machine-parseable and can be shipped to centralized log aggregation systems.

## Features

- **Structured JSON Logging**: All logs in production are JSON formatted for easy parsing
- **Pretty Printing in Development**: Human-readable logs during development using pino-pretty
- **Request Context Tracking**: Every request includes requestId, traceId, tenantId, and userId
- **Sensitive Data Redaction**: Automatic redaction of passwords, keys, and authorization headers
- **Configurable Log Levels**: Per-module log level configuration via environment variables
- **Centralized Log Shipping**: Integration with Loki for centralized log aggregation
- **Audit Logging**: Separate audit log stream with 7-year retention
- **Performance Monitoring**: Automatic detection and logging of slow requests

## Configuration

### Environment Variables

```env
# Log level (trace, debug, info, warn, error, fatal)
LOG_LEVEL=info

# Log file path for production
LOG_FILE_PATH=./logs

# Slow request threshold in milliseconds
SLOW_REQUEST_THRESHOLD_MS=1000

# Loki configuration for centralized logging
LOKI_HOST=http://localhost:3100
LOKI_USERNAME=
LOKI_PASSWORD=

# Log retention policies
APP_LOG_RETENTION_DAYS=30
AUDIT_LOG_RETENTION_DAYS=2555
```

### Log Levels by Environment

- **Development**: `debug` - Verbose logging with pretty printing
- **Staging**: `info` - Standard operational logs
- **Production**: `warn` - Only warnings and errors

## Log Format

### Production (JSON)

```json
{
  "level": 30,
  "timestamp": "2024-02-24T10:30:45.123Z",
  "pid": 12345,
  "hostname": "api-server-01",
  "environment": "production",
  "context": "AuthService",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "traceId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "tenantId": "tenant-123",
  "userId": "user-456",
  "message": "User authenticated successfully",
  "request": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "method": "POST",
    "url": "/api/v1/auth/login",
    "headers": {
      "host": "api.healthystellar.com",
      "user-agent": "Mozilla/5.0...",
      "content-type": "application/json"
    }
  },
  "response": {
    "statusCode": 200,
    "headers": {
      "content-type": "application/json"
    }
  },
  "duration": 245
}
```

### Development (Pretty)

```
[10:30:45.123] INFO (AuthService): User authenticated successfully
    requestId: "550e8400-e29b-41d4-a716-446655440000"
    traceId: "7c9e6679-7425-40de-944b-e07fc1f90ae7"
    userId: "user-456"
    duration: 245ms
```

## Sensitive Data Redaction

The following fields are automatically redacted from logs:

- `password`
- `stellarSecretKey`
- `encryptionKey`
- `authorization` headers
- `confirmPassword`
- `oldPassword`
- `newPassword`

Redacted fields show `[REDACTED]` in logs.

## Usage

### Basic Logging

```typescript
import { Injectable } from '@nestjs/common';
import { CustomLoggerService } from './common/logger/custom-logger.service';

@Injectable()
export class MyService {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('MyService');
  }

  doSomething() {
    this.logger.log('Operation started');
    this.logger.debug('Debug information');
    this.logger.warn('Warning message');
    this.logger.error('Error occurred', trace);
  }
}
```

### Audit Logging

```typescript
this.logger.audit('USER_LOGIN', {
  userId: user.id,
  ipAddress: req.ip,
  timestamp: new Date(),
});
```

### Security Logging

```typescript
this.logger.security('FAILED_LOGIN_ATTEMPT', {
  username: credentials.username,
  ipAddress: req.ip,
  attempts: failedAttempts,
});
```

### Performance Logging

```typescript
const startTime = Date.now();
// ... operation ...
const duration = Date.now() - startTime;
this.logger.performance('DATABASE_QUERY', duration);
```

## Request Context

Every log entry automatically includes:

- **requestId**: Unique identifier for each HTTP request
- **traceId**: Distributed tracing identifier
- **tenantId**: Multi-tenant identifier (if available)
- **userId**: Authenticated user identifier (if available)
- **timestamp**: ISO 8601 timestamp

These are extracted from:
1. HTTP headers (`X-Request-ID`, `X-Trace-ID`, `X-Tenant-ID`, `X-User-ID`)
2. JWT token payload
3. Auto-generated UUIDs if not provided

## Centralized Logging with Loki

### Setup

1. Configure Loki endpoint in `.env`:
```env
LOKI_HOST=http://loki:3100
LOKI_USERNAME=admin
LOKI_PASSWORD=secret
```

2. Logs are automatically batched and shipped to Loki in production

3. View logs in Grafana using the provided dashboard

### Grafana Dashboard

Import the dashboard from:
```
docker/monitoring/grafana/dashboards/logging-dashboard.json
```

Features:
- Error rate over time
- Request rate by log level
- Slow requests table (>1s)
- 5xx and 4xx errors by status code
- Audit log viewer

## Log Retention

### Application Logs
- **Retention**: 30 days
- **Location**: `./logs/app.log` (production)
- **Rotation**: Daily rotation with compression

### Audit Logs
- **Retention**: 7 years (2555 days) - HIPAA compliance
- **Location**: Loki with `logType=audit` label
- **Immutable**: Cannot be modified or deleted

## Performance Considerations

- **Async Logging**: All log writes are non-blocking
- **Batching**: Logs are batched before shipping to Loki (100 logs or 5 seconds)
- **Redaction**: Minimal performance impact using Pino's built-in redaction
- **Context Storage**: AsyncLocalStorage has negligible overhead

## Monitoring

### Key Metrics

Monitor these log-based metrics:

1. **Error Rate**: `sum(rate({app="healthy-stellar-backend"} |= "error" [5m]))`
2. **Request Rate**: `sum(rate({app="healthy-stellar-backend"} [5m]))`
3. **Slow Requests**: `{app="healthy-stellar-backend"} | json | duration > 1000`
4. **5xx Errors**: `{app="healthy-stellar-backend"} | json | statusCode >= 500`

### Alerts

Configure alerts for:
- Error rate > 1% of total requests
- Slow requests > 10% of total requests
- 5xx errors > 0.1% of total requests
- Failed audit log writes

## Troubleshooting

### Logs not appearing in Loki

1. Check Loki connectivity:
```bash
curl http://localhost:3100/ready
```

2. Verify environment variables:
```bash
echo $LOKI_HOST
```

3. Check application logs for Loki errors:
```bash
tail -f logs/app.log | grep -i loki
```

### High log volume

1. Increase log level to `warn` or `error`
2. Adjust batch size and interval
3. Enable log sampling for high-traffic endpoints

### Missing request context

1. Ensure `RequestContextMiddleware` is applied globally
2. Check that middleware runs before logging
3. Verify AsyncLocalStorage is enabled in Node.js

## Best Practices

1. **Use appropriate log levels**:
   - `error`: Errors requiring immediate attention
   - `warn`: Potential issues or degraded performance
   - `info`: Normal operational events
   - `debug`: Detailed debugging information
   - `trace`: Very verbose debugging

2. **Include context**: Always set context for your logger
3. **Structured data**: Use objects for structured logging
4. **Avoid PII**: Never log sensitive personal information
5. **Audit critical operations**: Use audit logging for compliance
6. **Monitor performance**: Log slow operations for optimization

## Compliance

### HIPAA Requirements

- ✅ All access to PHI is logged
- ✅ Logs include user identification
- ✅ Logs are tamper-evident (immutable in Loki)
- ✅ 7-year retention for audit logs
- ✅ Sensitive data is redacted

### GDPR Requirements

- ✅ Personal data is pseudonymized (user IDs, not names)
- ✅ Logs can be filtered by user for data export
- ✅ Retention policies are enforced
- ✅ Access logs are maintained

## References

- [Pino Documentation](https://getpino.io/)
- [nestjs-pino](https://github.com/iamolegga/nestjs-pino)
- [Grafana Loki](https://grafana.com/oss/loki/)
- [HIPAA Logging Requirements](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)
