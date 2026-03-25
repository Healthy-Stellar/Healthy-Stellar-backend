# API Key Authentication Integration

## Overview

This document describes the implementation of API key-based authentication for hospital information systems and automated integrations that cannot perform Stellar wallet signing.

## Architecture

### Components

1. **API Key Entity** (`api-key.entity.ts`)
   - Stores hashed API keys with SHA-256
   - Associates keys with users (creator)
   - Tracks usage (last accessed, IP address)
   - Configurable scopes for fine-grained access control

2. **API Key Service** (`api-key.service.ts`)
   - Manages CRUD operations for API keys
   - Validates API keys against stored hashes
   - Enforces scope-based access control
   - Handles key generation and hashing

3. **API Key Guard** (`guards/api-key.guard.ts`)
   - Validates X-API-Key header
   - Checks scope requirements via decorator
   - Attaches API key to request for later use

4. **API Key Strategy** (`strategies/api-key.strategy.ts`)
   - Passport.js custom strategy
   - Integrates with NestJS authentication
   - Validates API keys and extracts payload

5. **API Key Throttler** (`common/throttler/api-key-throttler.guard.ts`)
   - Rate limits API key requests separately from JWT users
   - Default: 50 requests per minute per API key
   - Configurable via decorators

6. **Admin Controller** (`admin/admin.controller.ts`)
   - POST /admin/api-keys - Create new API key
   - GET /admin/api-keys - List all keys
   - DELETE /admin/api-keys/:id - Revoke API key

### Scopes

Three configurable scopes for API keys:

```typescript
enum ApiKeyScope {
  READ_RECORDS = 'read:records',      // Read medical records
  WRITE_RECORDS = 'write:records',    // Write/update records
  READ_PATIENTS = 'read:patients',    // Read patient information
}
```

## Usage

### Creating an API Key

```http
POST /admin/api-keys
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "name": "Hospital Integration Key",
  "description": "For hospital information system integration",
  "scopes": ["read:records", "write:records"]
}
```

Response (key returned only once):

```json
{
  "id": "key-uuid",
  "name": "Hospital Integration Key",
  "description": "For hospital information system integration",
  "scopes": ["read:records", "write:records"],
  "isActive": true,
  "createdAt": "2026-03-24T12:00:00Z",
  "createdBy": {
    "id": "user-uuid",
    "email": "admin@hospital.com",
    "firstName": "Admin",
    "lastName": "User"
  },
  "key": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
}
```

### Using an API Key

```http
GET /api/records
X-API-Key: abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789
```

### Listing API Keys

```http
GET /admin/api-keys
Authorization: Bearer <JWT_TOKEN>
```

### Revoking an API Key

```http
DELETE /admin/api-keys/{id}
Authorization: Bearer <JWT_TOKEN>
```

## Security Features

1. **Key Hashing**: API keys are hashed using SHA-256
   - Only hashes are stored in database
   - Raw key never stored, returned only once during creation

2. **Scope-Based Access Control**
   - Route decorators enforce required scopes
   - Keys can be limited to specific operations

3. **Usage Tracking**
   - Audit logs track key creation/revocation
   - Last access time and IP recorded

4. **Rate Limiting**
   - API key requests limited to 50 per minute
   - Separate from JWT rate limiting (100 per minute)
   - Prevents abuse and DoS attacks

5. **Audit Trail**
   - All API key operations logged
   - Includes: creation, revocation, usage

## Database Schema

### api_keys table

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | VARCHAR(255) | Unique, human-readable name |
| description | TEXT | Purpose of the key |
| key_hash | VARCHAR(64) | SHA-256 hash of the API key |
| scopes | TEXT[] | Array of assigned scopes |
| is_active | BOOLEAN | Key activation status |
| last_used_at | TIMESTAMP | Track usage |
| last_used_by_ip | INET | Track usage source |
| created_by_id | UUID | Foreign key to users |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last modification |
| deleted_at | TIMESTAMP | Soft delete support |

## Testing

### Unit Tests

- `test/unit/api-key.service.spec.ts` - API key service tests
- `test/unit/api-key.guard.spec.ts` - Guard validation tests
- `test/unit/api-key.strategy.spec.ts` - Strategy tests

Coverage includes:
- Key creation and validation
- Scope enforcement
- Error handling
- Rate limiting

### Integration Tests

```typescript
// Example: Using API key in HTTP request
it('should authenticate with valid API key', async () => {
  const { key } = await createApiKey(scopes);
  
  const response = await request(app.getHttpServer())
    .get('/api/records')
    .set('X-API-Key', key)
    .expect(200);
});
```

## Migration

Database migration: `1772500000000-CreateApiKeysTable.ts`

Run migrations:
```bash
npm run migration:run
```

## Configuration

No additional configuration required. Rate limits can be customized per endpoint using decorators:

```typescript
@ApiKeyScopes(ApiKeyScope.READ_RECORDS)
@RateLimit(100, 60) // Override default throttle: 100 req/min
@Get('advanced-search')
async advancedSearch() {}
```

## Best Practices

1. **Key Rotation**: Implement periodic key rotation
2. **Scope Limitation**: Assign minimal required scopes
3. **IP Whitelisting**: Monitor last_used_by_ip for anomalies
4. **Audit Review**: Regularly review audit logs for key access
5. **Emergency Revocation**: Revoke keys immediately if compromised

## Troubleshooting

### Invalid API Key Error
- Verify key hasn't been revoked
- Check spelling and formatting (64 hex characters)
- Ensure X-API-Key header is present

### Insufficient Scope Error
- Check required scopes in endpoint decorator
- Request new key or revoke/recreate with correct scopes

### Rate Limit Exceeded
- Default: 50 requests/minute per key
- Check X-RateLimit-Reset header for reset time
- Implement exponential backoff in client

## Related Documentation

- [Throttling Guide](../../docs/throttling.md)
- [Security Best Practices](../../docs/security.md)
- [Audit logging](../../docs/audit-logging.md)