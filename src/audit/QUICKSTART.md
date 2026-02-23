# Audit Service - Quick Start Guide

Get the Immutable Audit Log Service up and running in 5 minutes.

## 🚀 Quick Setup

### Step 1: Run Migration

```bash
npm run migration:run
```

This creates the `audit_logs` table with immutability triggers.

### Step 2: Import Module

Add to your `app.module.ts`:

```typescript
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    AuditModule,
    // ... other modules
  ],
})
export class AppModule {}
```

### Step 3: Apply Interceptor

Add to your `records.controller.ts`:

```typescript
import { UseInterceptors } from '@nestjs/common';
import { AuditInterceptor } from './audit/interceptors/audit.interceptor';

@Controller('records')
@UseInterceptors(AuditInterceptor)
export class RecordsController {
  // All requests will be automatically logged!
}
```

That's it! All requests to RecordsController are now automatically audited.

## 📝 Basic Usage

### Automatic Logging (Recommended)

Just apply the interceptor - no code changes needed:

```typescript
@Controller('records')
@UseInterceptors(AuditInterceptor)
export class RecordsController {
  @Get(':id')
  async getRecord(@Param('id') id: string) {
    // This request is automatically logged
    return this.recordsService.findOne(id);
  }
}
```

### Manual Logging

For custom audit events:

```typescript
import { AuditService, AuditAction, ResourceType } from './audit';

@Injectable()
export class MyService {
  constructor(private readonly auditService: AuditService) {}

  async someMethod() {
    await this.auditService.log({
      actorId: 'user-123',
      action: AuditAction.RECORD_READ,
      resourceId: 'record-456',
      resourceType: ResourceType.RECORD,
    });
  }
}
```

## 🔍 Querying Logs

### REST API

```bash
# Get all logs (Admin only)
curl http://localhost:3000/audit?page=1&limit=50

# Get patient's logs
curl http://localhost:3000/audit?patientId=123e4567-e89b-12d3-a456-426614174000

# Filter by date range
curl http://localhost:3000/audit?fromDate=2024-01-01T00:00:00Z&toDate=2024-12-31T23:59:59Z

# Export as CSV
curl http://localhost:3000/audit/export?patientId=123 > audit-logs.csv
```

### Programmatic

```typescript
const result = await this.auditService.query(
  {
    patientId: 'patient-123',
    page: 1,
    limit: 50,
  },
  'requesting-user-id',
  'ADMIN'
);

console.log(result.data); // Array of audit logs
console.log(result.total); // Total count
```

## 📊 Common Patterns

### Pattern 1: Audit Record Access

```typescript
@Get(':id')
async getRecord(@Param('id') id: string, @Req() req: any) {
  const record = await this.recordsService.findOne(id);
  
  // Log with additional context
  await this.auditService.logRecordAccess(
    req.user.id,
    AuditAction.RECORD_READ,
    id,
    record.patientId,
    { recordType: record.type }
  );
  
  return record;
}
```

### Pattern 2: Audit Access Grants

```typescript
@Post('access-grants')
async grantAccess(@Body() dto: GrantAccessDto, @Req() req: any) {
  const grant = await this.accessService.grant(dto);
  
  await this.auditService.log({
    actorId: req.user.id,
    action: AuditAction.ACCESS_GRANT,
    resourceId: grant.id,
    resourceType: ResourceType.ACCESS_GRANT,
    metadata: {
      grantedTo: dto.userId,
      patientId: dto.patientId,
      expiresAt: dto.expiresAt,
    },
  });
  
  return grant;
}
```

### Pattern 3: Export Audit Report

```typescript
@Get('reports/audit')
async exportAuditReport(@Query() query: any, @Req() req: any) {
  const csv = await this.auditService.exportToCsv(
    {
      fromDate: query.fromDate,
      toDate: query.toDate,
      patientId: query.patientId,
    },
    req.user.id,
    'ADMIN'
  );
  
  return {
    filename: `audit-report-${Date.now()}.csv`,
    content: csv,
  };
}
```

## 🔒 Security Notes

### Role-Based Access

- **Admins**: Can query all audit logs
- **Patients**: Can only query their own logs
- **Others**: Cannot query audit logs

### Immutability

Audit logs cannot be updated or deleted:

```typescript
// ❌ This will fail
await auditLogRepository.update(id, { action: 'MODIFIED' });

// ❌ This will also fail
await auditLogRepository.delete(id);

// ✅ Only this is allowed (once)
await auditService.anchorToStellar(id, 'stellar-tx-hash');
```

## 📋 Available Actions

```typescript
// Record Operations
AuditAction.RECORD_READ
AuditAction.RECORD_WRITE
AuditAction.RECORD_CREATE
AuditAction.RECORD_UPDATE
AuditAction.RECORD_DELETE

// Access Control
AuditAction.ACCESS_GRANT
AuditAction.ACCESS_REVOKE
AuditAction.ACCESS_DENIED

// PHI Operations
AuditAction.PHI_ACCESS
AuditAction.PHI_MODIFY
AuditAction.PHI_EXPORT

// Security
AuditAction.SECURITY_VIOLATION
AuditAction.SUSPICIOUS_ACTIVITY
```

## 📋 Available Resource Types

```typescript
ResourceType.RECORD
ResourceType.PATIENT
ResourceType.USER
ResourceType.ACCESS_GRANT
ResourceType.APPOINTMENT
ResourceType.PRESCRIPTION
ResourceType.LAB_RESULT
ResourceType.IMAGING
ResourceType.SYSTEM
```

## 🧪 Testing

```bash
# Run audit tests
npm test -- audit/

# Run specific test file
npm test audit.service.spec.ts
npm test audit.interceptor.spec.ts
```

## 🐛 Troubleshooting

### Logs not appearing?

Logs are buffered for performance. Wait 3 seconds or log 100 entries to trigger a flush.

### Permission denied?

Ensure the user has the correct role (ADMIN or PATIENT) and patients can only query their own logs.

### Cannot update audit log?

This is by design - audit logs are immutable. Only `stellarTxHash` can be set once.

## 📚 Full Documentation

For complete documentation, see [README.md](./README.md)

## 🎯 Next Steps

1. ✅ Apply `AuditInterceptor` to all controllers that handle sensitive data
2. ✅ Add custom audit logging for business-critical operations
3. ✅ Set up monitoring for audit events (via EventEmitter)
4. ✅ Configure Stellar anchoring for tamper-evidence
5. ✅ Set up automated audit reports for compliance

---

**Need help?** Check the [README.md](./README.md) or [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
