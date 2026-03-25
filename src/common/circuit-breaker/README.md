# Circuit Breaker Implementation

This module implements the circuit breaker pattern to protect the application from cascading failures when external dependencies (Stellar Horizon, IPFS, AWS KMS, Mail Service) become unavailable or slow.

## Overview

The circuit breaker pattern prevents an application from repeatedly trying to execute an operation that's likely to fail, allowing it to continue without waiting for the fault to be fixed or wasting CPU cycles while it determines that the fault is long-lasting.

## Features

- **Fail Fast**: When a circuit is open, requests fail immediately without attempting the operation
- **Automatic Recovery**: Circuits automatically transition to half-open state after a timeout
- **Service-Specific Configuration**: Each service has tailored thresholds and timeouts
- **Prometheus Metrics**: Circuit breaker states are exposed as Prometheus metrics
- **Health Check Integration**: Circuit states are included in health check endpoints
- **Retry Policies**: Built-in exponential backoff retry logic

## Circuit Breaker States

1. **Closed**: Normal operation, requests pass through
2. **Open**: Failures exceeded threshold, requests fail immediately with 503
3. **Half-Open**: Testing if service recovered, limited requests allowed

## Service Configurations

### Stellar Horizon
- **Failure Threshold**: 5 failures in 30 seconds
- **Half-Open After**: 60 seconds
- **Retry Attempts**: 3
- **Use Case**: Blockchain operations, smart contract calls

### IPFS
- **Failure Threshold**: 3 failures in 20 seconds
- **Half-Open After**: 45 seconds
- **Retry Attempts**: 3
- **Use Case**: File uploads, content retrieval

### KMS (Key Management Service)
- **Failure Threshold**: 2 failures in 10 seconds (stricter)
- **Half-Open After**: 30 seconds
- **Retry Attempts**: 2
- **Use Case**: Encryption/decryption operations (critical)

### Mail Service
- **Failure Threshold**: 3 failures in 20 seconds
- **Half-Open After**: 45 seconds
- **Retry Attempts**: 3
- **Use Case**: Email notifications

## Usage

### Using Wrapped Services

The recommended approach is to use the circuit breaker-wrapped services:

```typescript
import { StellarWithBreakerService } from './stellar/services/stellar-with-breaker.service';

@Injectable()
export class MyService {
  constructor(
    private readonly stellarService: StellarWithBreakerService,
  ) {}

  async anchorRecord(patientId: string, cid: string) {
    try {
      return await this.stellarService.anchorRecord(patientId, cid);
    } catch (error) {
      if (error instanceof CircuitOpenException) {
        // Circuit is open, service unavailable
        // Error response includes Retry-After header
        throw error;
      }
      // Handle other errors
      throw error;
    }
  }
}
```

### Direct Circuit Breaker Usage

For custom services, use the CircuitBreakerService directly:

```typescript
import { CircuitBreakerService } from './common/circuit-breaker/circuit-breaker.service';

@Injectable()
export class CustomService {
  constructor(
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async callExternalApi() {
    return this.circuitBreaker.execute('stellar', async () => {
      // Your external API call here
      return await this.externalApi.call();
    });
  }
}
```

## HTTP Response

When a circuit is open, the API returns:

```http
HTTP/1.1 503 Service Unavailable
Retry-After: 60
Content-Type: application/json

{
  "statusCode": 503,
  "message": "Service temporarily unavailable: stellar circuit breaker is open",
  "error": "Service Unavailable",
  "retryAfter": 60,
  "timestamp": "2025-02-24T10:30:00.000Z"
}
```

## Health Check Endpoint

Circuit breaker states are exposed via the health check endpoint:

```bash
GET /health/ready
```

Response:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "ipfs": { "status": "up" },
    "stellar": { "status": "up" }
  },
  "circuitBreakers": {
    "stellar": "closed",
    "ipfs": "closed",
    "kms": "closed",
    "mail": "closed"
  }
}
```

Detailed circuit breaker stats:
```bash
GET /health/circuit-breakers
```

Response:
```json
{
  "states": {
    "stellar": "closed",
    "ipfs": "closed",
    "kms": "closed",
    "mail": "closed"
  },
  "details": [
    {
      "service": "stellar",
      "state": "closed",
      "lastStateChange": "2025-02-24T10:00:00.000Z",
      "failureCount": 0,
      "successCount": 42
    }
  ]
}
```

## Prometheus Metrics

### Circuit Breaker State Gauge
```
medchain_circuit_breaker_state{service="stellar"} 0
medchain_circuit_breaker_state{service="ipfs"} 0
medchain_circuit_breaker_state{service="kms"} 0
medchain_circuit_breaker_state{service="mail"} 0
```

Values:
- `0` = closed
- `1` = half-open
- `2` = open

### State Change Counter
```
medchain_circuit_breaker_state_changes_total{service="stellar",from_state="closed",to_state="open"} 3
medchain_circuit_breaker_state_changes_total{service="stellar",from_state="open",to_state="half-open"} 2
medchain_circuit_breaker_state_changes_total{service="stellar",from_state="half-open",to_state="closed"} 2
```

## Logging

Circuit breaker state transitions are logged at WARN level:

```
[CircuitBreakerService] Circuit breaker state transition: service=stellar from=closed to=open
[CircuitBreakerService] Circuit breaker state transition: service=stellar from=open to=half-open
[CircuitBreakerService] Circuit breaker state transition: service=stellar from=half-open to=closed
```

When a circuit is open and requests fail fast:
```
[StellarWithBreakerService] Circuit breaker is OPEN for stellar - failing fast
```

## Testing

### Unit Tests

Run circuit breaker unit tests:
```bash
npm test -- circuit-breaker.service.spec.ts
```

### Integration Tests

Test circuit breaker behavior with real services:
```bash
npm test -- circuit-breaker.integration.spec.ts
```

### Manual Testing

1. Simulate service failures by stopping dependencies:
```bash
docker-compose stop ipfs
```

2. Make requests to trigger circuit opening:
```bash
for i in {1..5}; do curl http://localhost:3000/api/records/upload; done
```

3. Observe circuit state:
```bash
curl http://localhost:3000/health/circuit-breakers
```

4. Restart service and observe recovery:
```bash
docker-compose start ipfs
```

## Configuration

Circuit breaker settings are defined in `circuit-breaker.config.ts`:

```typescript
export const CIRCUIT_BREAKER_CONFIGS: Record<string, CircuitBreakerConfig> = {
  stellar: {
    failureThreshold: 5,
    failureWindow: 30,
    halfOpenAfter: 60,
    retryAttempts: 3,
    retryBackoff: 500,
  },
  // ... other services
};
```

To customize, modify the configuration values and restart the application.

## Architecture

```
┌─────────────────┐
│   Controller    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Service with Breaker    │
│ (e.g., StellarWith      │
│  BreakerService)        │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ CircuitBreakerService   │
│ - State Management      │
│ - Metrics               │
│ - Logging               │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Cockatiel Policy        │
│ - Circuit Breaker       │
│ - Retry Logic           │
│ - Backoff               │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ External Service        │
│ (Stellar, IPFS, etc.)   │
└─────────────────────────┘
```

## Best Practices

1. **Monitor Circuit States**: Set up alerts for circuit state changes
2. **Tune Thresholds**: Adjust failure thresholds based on service SLAs
3. **Graceful Degradation**: Implement fallback logic when circuits are open
4. **Test Failure Scenarios**: Regularly test circuit breaker behavior
5. **Document Dependencies**: Keep track of which services use circuit breakers

## Troubleshooting

### Circuit Opens Too Frequently
- Increase `failureThreshold`
- Increase `failureWindow`
- Check if external service is actually degraded

### Circuit Stays Open Too Long
- Decrease `halfOpenAfter` timeout
- Verify external service has recovered
- Check network connectivity

### Requests Still Slow When Circuit is Closed
- Review retry configuration
- Check if timeout values are appropriate
- Consider adding request timeouts

## References

- [Cockatiel Documentation](https://github.com/connor4312/cockatiel)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Prometheus Metrics](https://prometheus.io/docs/concepts/metric_types/)
