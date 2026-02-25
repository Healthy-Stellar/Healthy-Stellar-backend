# Global Exception Filter

## Overview
The `GlobalExceptionFilter` provides unified error handling across the entire application with consistent response envelopes and special handling for FHIR endpoints.

## Error Response Envelope

```typescript
{
  statusCode: number;      // HTTP status code
  error: string;           // HTTP error name (e.g., "Bad Request")
  message: string;         // Human-readable description
  code: string;            // Machine-readable error code (e.g., "RECORD_NOT_FOUND")
  traceId: string;         // UUID for log correlation
  timestamp: string;       // ISO 8601 timestamp
  path: string;            // Request path
  details?: object;        // Optional field-level info
}
```

## Custom Exception Classes

### RecordNotFoundException
```typescript
throw new RecordNotFoundException('Patient', '123');
// Returns: { code: 'RECORD_NOT_FOUND', statusCode: 404, ... }
```

### AccessDeniedException
```typescript
throw new AccessDeniedException('medical records', 'Insufficient permissions');
// Returns: { code: 'ACCESS_DENIED', statusCode: 403, ... }
```

### StellarTransactionException
```typescript
throw new StellarTransactionException('Transaction failed', 'txHash123', 'op_underfunded');
// Returns: { code: 'STELLAR_TRANSACTION_ERROR', statusCode: 502, details: { txHash, stellarErrorCode }, ... }
```

### IpfsUploadException
```typescript
throw new IpfsUploadException('Upload failed', { size: 1024 });
// Returns: { code: 'IPFS_UPLOAD_ERROR', statusCode: 502, details: { size: 1024 }, ... }
```

### TenantNotFoundException
```typescript
throw new TenantNotFoundException('tenant-123');
// Returns: { code: 'TENANT_NOT_FOUND', statusCode: 404, ... }
```

## Validation Errors

ValidationPipe errors are automatically formatted:
```typescript
// Input validation error
{
  statusCode: 400,
  message: "Validation failed",
  code: "BAD_REQUEST",
  details: [
    { field: "email", message: "must be an email" },
    { field: "age", message: "must be at least 18" }
  ]
}
```

## FHIR Endpoints

Endpoints starting with `/fhir` return FHIR OperationOutcome:
```typescript
{
  resourceType: "OperationOutcome",
  issue: [{
    severity: "error",
    code: "not-found",
    diagnostics: "Patient not found"
  }]
}
```

## Security

- 500 errors: Full stack trace logged but generic message returned to client
- All errors include traceId for log correlation
- No sensitive data leaked in error responses

## Usage

Already registered globally in `main.ts`:
```typescript
app.useGlobalFilters(new GlobalExceptionFilter());
```
