# Logging Migration Guide

## Overview

This guide helps you migrate from the default NestJS logger to the new Pino-based structured logging system.

## Quick Start

### 1. Update Service Constructor

**Before:**
```typescript
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);

  doSomething() {
    this.logger.log('Operation started');
  }
}
```

**After:**
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
  }
}
```

### 2. Update Log Calls

The API is mostly compatible, but you can now use structured logging:

**Before:**
```typescript
this.logger.log(`User ${userId} logged in from ${ipAddress}`);
```

**After (Structured):**
```typescript
this.logger.log({
  message: 'User logged in',
  userId,
  ipAddress,
});
```

### 3. Replace console.log

**Before:**
```typescript
console.log('Debug info:', data);
console.error('Error occurred:', error);
```

**After:**
```typescript
this.logger.debug({ message: 'Debug info', data });
this.logger.error({ message: 'Error occurred', error: error.message });
```

## Method Mapping

| Old Method | New Method | Notes |
|------------|------------|-------|
| `logger.log()` | `logger.log()` | Same API |
| `logger.error()` | `logger.error()` | Same API |
| `logger.warn()` | `logger.warn()` | Same API |
| `logger.debug()` | `logger.debug()` | Same API |
| `logger.verbose()` | `logger.verbose()` | Same API |
| N/A | `logger.audit()` | New: For audit events |
| N/A | `logger.security()` | New: For security events |
| N/A | `logger.performance()` | New: For performance metrics |

## Special Use Cases

### Audit Logging

For HIPAA compliance, use audit logging for sensitive operations:

```typescript
this.logger.audit('PATIENT_RECORD_ACCESSED', {
  patientId: record.patientId,
  userId: user.id,
  action: 'READ',
  timestamp: new Date(),
});
```

### Security Events

Log security-related events:

```typescript
this.logger.security('SUSPICIOUS_ACTIVITY', {
  userId: user.id,
  ipAddress: req.ip,
  reason: 'Multiple failed login attempts',
  attempts: 5,
});
```

### Performance Tracking

Track slow operations:

```typescript
const startTime = Date.now();
await this.heavyOperation();
const duration = Date.now() - startTime;

if (duration > 1000) {
  this.logger.performance('HEAVY_OPERATION', duration);
}
```

### Error Logging with Context

**Before:**
```typescript
try {
  await this.riskyOperation();
} catch (error) {
  this.logger.error(`Operation failed: ${error.message}`);
}
```

**After:**
```typescript
try {
  await this.riskyOperation();
} catch (error) {
  this.logger.error({
    message: 'Operation failed',
    error: error.message,
    stack: error.stack,
    operationId: operation.id,
  });
}
```

## Testing

Update your tests to use the new logger:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CustomLoggerService } from './common/logger/custom-logger.service';
import { PinoLogger } from 'nestjs-pino';

describe('MyService', () => {
  let service: MyService;
  let logger: CustomLoggerService;

  beforeEach(async () => {
    const mockPinoLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      setContext: jest.fn(),
      context: 'TestContext',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        CustomLoggerService,
        {
          provide: PinoLogger,
          useValue: mockPinoLogger,
        },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
    logger = module.get<CustomLoggerService>(CustomLoggerService);
  });

  it('should log operation', () => {
    const logSpy = jest.spyOn(logger, 'log');
    service.doSomething();
    expect(logSpy).toHaveBeenCalledWith('Operation started');
  });
});
```

## Common Patterns

### Request Logging

The request context is automatically added to all logs:

```typescript
// No need to manually add requestId, it's automatic
this.logger.log('Processing request');

// Output includes:
// {
//   "message": "Processing request",
//   "requestId": "550e8400-e29b-41d4-a716-446655440000",
//   "traceId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
//   "userId": "user-123"
// }
```

### Conditional Logging

Use log levels to control verbosity:

```typescript
// Only logs in debug mode
this.logger.debug('Detailed debug information');

// Always logs (unless level is error)
this.logger.warn('Important warning');
```

### Structured Data

Always prefer structured data over string concatenation:

**Bad:**
```typescript
this.logger.log(`User ${user.id} updated profile with ${changes.length} changes`);
```

**Good:**
```typescript
this.logger.log({
  message: 'User updated profile',
  userId: user.id,
  changeCount: changes.length,
  changes: changes.map(c => c.field),
});
```

## Checklist

- [ ] Replace all `Logger` imports with `CustomLoggerService`
- [ ] Update service constructors to inject logger
- [ ] Replace `console.log` with appropriate logger methods
- [ ] Add audit logging for sensitive operations
- [ ] Add security logging for authentication/authorization events
- [ ] Add performance logging for slow operations
- [ ] Update tests to mock the new logger
- [ ] Remove any custom logging middleware (now handled by Pino)
- [ ] Configure log levels per environment
- [ ] Set up Loki for centralized logging (production)

## Rollout Strategy

1. **Phase 1**: Install dependencies and configure logger module
2. **Phase 2**: Migrate critical services (auth, medical records)
3. **Phase 3**: Migrate remaining services
4. **Phase 4**: Remove old logger references
5. **Phase 5**: Set up Grafana dashboards and alerts

## Troubleshooting

### Logger not injecting

Make sure `LoggerModule` is imported in `AppModule`:

```typescript
@Module({
  imports: [
    LoggerModule, // Add this
    // ... other modules
  ],
})
export class AppModule {}
```

### Logs not showing in development

Check `LOG_LEVEL` environment variable:

```bash
LOG_LEVEL=debug npm run start:dev
```

### Missing request context

Ensure `RequestContextMiddleware` is applied:

```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
```

## Support

For questions or issues, refer to:
- [Logging Implementation Guide](./logging-implementation.md)
- [Pino Documentation](https://getpino.io/)
- [nestjs-pino GitHub](https://github.com/iamolegga/nestjs-pino)
