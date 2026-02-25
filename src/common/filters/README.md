# Global Exception Filter Implementation

## Overview

The Global Exception Filter provides a unified, consistent error response format across all API endpoints, ensuring clients can reliably parse and handle errors.

## Features

✅ **Unified Error Response Envelope**
- Consistent structure across all error types
- Machine-readable error codes
- Human-readable messages
- Trace IDs for log correlation
- ISO 8601 timestamps
- Request path tracking

✅ **Custom Exception Classes**
- `RecordNotFoundException` - For missing database records
- `AccessDeniedException` - For authorization failures
- `StellarTransactionException` - For blockchain transaction errors
- `IpfsUploadException` - For IPFS upload failures
- `TenantNotFoundException` - For missing tenant records

✅ **ValidationPipe Integration**
- Formats validation errors into structured details array
- Field-level error messages
- Multiple validation errors per request

✅ **Security Features**
- No stack trace leakage in production
- Generic error messages for 500 errors
- Full stack traces logged server-side

✅ **FHIR Compatibility**
- Returns FHIR OperationOutcome for `/fhir/*` endpoints
- Maintains standard envelope for all other endpoints

## Error Response Envelope

```typescript
{
  statusCode: number;        // HTTP status code
  error: string;             // HTTP error name (e.g., "Bad Request")
  message: string;           // Human-readable description
  code: string;              // Machine-readable code (e.g., "RECORD_NOT_FOUND")
  traceId: string;           // UUID for log correlation
  timestamp: string;         // ISO 8601 timestamp
  path: string;              // Request path
  details?: object;          // Optional field-level details
}
```

## Usage Examples

### RecordNotFoundException

```typescript
import { RecordNotFoundException } from '@/common/exceptions';

throw new RecordNotFoundException('Patient', '123');
```

**Response:**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Patient with ID 123 not found",
  "code": "RECORD_NOT_FOUND",
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/patients/123"
}
```

### AccessDeniedException

```typescript
import { AccessDeniedException } from '@/common/exceptions';

throw new AccessDeniedException('medical records', 'Insufficient permissions');
```

**Response:**
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Insufficient permissions",
  "code": "ACCESS_DENIED",
  "traceId": "550e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2024-01-15T10:31:00.000Z",
  "path": "/api/medical-records/456"
}
```

### StellarTransactionException

```typescript
import { StellarTransactionException } from '@/common/exceptions';

throw new StellarTransactionException(
  'Transaction failed on Stellar network',
  '0xabc123def456',
  'STELLAR_ERR_INSUFFICIENT_BALANCE'
);
```

**Response:**
```json
{
  "statusCode": 502,
  "error": "Bad Gateway",
  "message": "Transaction failed on Stellar network",
  "code": "STELLAR_TRANSACTION_ERROR",
  "traceId": "550e8400-e29b-41d4-a716-446655440002",
  "timestamp": "2024-01-15T10:32:00.000Z",
  "path": "/api/stellar/transaction",
  "details": {
    "txHash": "0xabc123def456",
    "stellarErrorCode": "STELLAR_ERR_INSUFFICIENT_BALANCE"
  }
}
```

### IpfsUploadException

```typescript
import { IpfsUploadException } from '@/common/exceptions';

throw new IpfsUploadException('Failed to upload to IPFS', {
  fileSize: 1024000,
  fileName: 'medical-report.pdf',
  ipfsError: 'Connection timeout'
});
```

**Response:**
```json
{
  "statusCode": 502,
  "error": "Bad Gateway",
  "message": "Failed to upload to IPFS",
  "code": "IPFS_UPLOAD_ERROR",
  "traceId": "550e8400-e29b-41d4-a716-446655440003",
  "timestamp": "2024-01-15T10:33:00.000Z",
  "path": "/api/upload",
  "details": {
    "fileSize": 1024000,
    "fileName": "medical-report.pdf",
    "ipfsError": "Connection timeout"
  }
}
```

### TenantNotFoundException

```typescript
import { TenantNotFoundException } from '@/common/exceptions';

throw new TenantNotFoundException('tenant-abc-123');
```

**Response:**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Tenant with ID tenant-abc-123 not found",
  "code": "TENANT_NOT_FOUND",
  "traceId": "550e8400-e29b-41d4-a716-446655440004",
  "timestamp": "2024-01-15T10:34:00.000Z",
  "path": "/api/tenants/tenant-abc-123"
}
```

### ValidationPipe Errors

When using NestJS ValidationPipe with class-validator decorators:

```typescript
class CreatePatientDto {
  @IsEmail()
  email: string;

  @Min(18)
  age: number;
}
```

**Response:**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "code": "BAD_REQUEST",
  "traceId": "550e8400-e29b-41d4-a716-446655440005",
  "timestamp": "2024-01-15T10:35:00.000Z",
  "path": "/api/patients",
  "details": [
    {
      "field": "email",
      "message": "email must be an email"
    },
    {
      "field": "age",
      "message": "age must be at least 18"
    }
  ]
}
```

### Internal Server Errors (500)

For unhandled exceptions:

**Response:**
```json
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "code": "INTERNAL_ERROR",
  "traceId": "550e8400-e29b-41d4-a716-446655440006",
  "timestamp": "2024-01-15T10:36:00.000Z",
  "path": "/api/some-endpoint"
}
```

**Note:** Stack traces are logged server-side but never exposed to clients.

### FHIR Endpoints

For endpoints starting with `/fhir/`, the filter returns FHIR OperationOutcome:

**Response:**
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "warning",
      "code": "not-found",
      "diagnostics": "Patient not found"
    }
  ]
}
```

## Error Codes Reference

| HTTP Status | Error Name | Error Code | Description |
|------------|-----------|-----------|-------------|
| 400 | Bad Request | `BAD_REQUEST` | Invalid request format or parameters |
| 401 | Unauthorized | `UNAUTHORIZED` | Authentication required or failed |
| 403 | Forbidden | `ACCESS_DENIED` | Insufficient permissions |
| 404 | Not Found | `RECORD_NOT_FOUND` / `TENANT_NOT_FOUND` | Resource not found |
| 409 | Conflict | `CONFLICT` | Resource conflict (e.g., duplicate) |
| 422 | Unprocessable Entity | `VALIDATION_ERROR` | Validation failed |
| 500 | Internal Server Error | `INTERNAL_ERROR` | Unexpected server error |
| 502 | Bad Gateway | `STELLAR_TRANSACTION_ERROR` / `IPFS_UPLOAD_ERROR` | External service error |
| 503 | Service Unavailable | `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

## Logging

The filter automatically logs errors with appropriate severity:

- **500+ errors**: Logged as `ERROR` with full stack trace
- **400-499 errors**: Logged as `WARN` with error details

All logs include the `traceId` for correlation.

## Testing

Run the comprehensive test suite:

```bash
npm test -- http-exception.filter.spec.ts
```

The test suite verifies:
- ✅ Correct envelope shape for each exception type
- ✅ ValidationPipe error formatting
- ✅ Internal error handling without stack trace leakage
- ✅ FHIR endpoint special handling
- ✅ TraceId generation (UUID v4)
- ✅ ISO 8601 timestamp format

## Migration from Old Filter

The new `GlobalExceptionFilter` is backward compatible. The old `HttpExceptionFilter` is exported as an alias:

```typescript
// Both work
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
```

## Best Practices

1. **Use custom exceptions** for domain-specific errors
2. **Include context** in error messages (IDs, resource types)
3. **Provide details** for complex errors (validation, external services)
4. **Log traceId** in application logs for correlation
5. **Never expose** sensitive data in error messages
6. **Use appropriate** HTTP status codes

## Implementation Checklist

- ✅ GlobalExceptionFilter created and registered in main.ts
- ✅ Unified error response envelope with all required fields
- ✅ Custom exception classes: RecordNotFoundException, AccessDeniedException, StellarTransactionException, IpfsUploadException, TenantNotFoundException
- ✅ ValidationPipe errors formatted into details array
- ✅ StellarTransactionException includes txHash and stellarErrorCode
- ✅ Internal 500 errors log full stack trace but return generic message
- ✅ FHIR endpoints return OperationOutcome
- ✅ Unit tests verify correct envelope shape for each exception type
