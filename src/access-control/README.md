# Access Control Module

## Overview
The Access Control module implements the core consent management system, allowing patients to grant, view, and revoke access to their medical records for specific providers.

## Features

### Endpoints

#### POST /access/grant
Patient grants access to a provider.
- **Request Body**: `CreateAccessGrantDto`
- **Response**: `AccessGrant` object
- **Status Codes**: 
  - 201: Access granted successfully
  - 409: Duplicate grant exists

#### DELETE /access/grant/:grantId
Patient revokes access.
- **Query Params**: `reason` (optional)
- **Response**: Updated `AccessGrant` object
- **Status Codes**:
  - 200: Access revoked successfully
  - 404: Grant not found

#### GET /access/grants
Lists all active grants for the authenticated patient.
- **Response**: Array of `AccessGrant` objects
- **Status Codes**: 200: Success

#### GET /access/received
Lists all grants the authenticated provider has received.
- **Response**: Array of `AccessGrant` objects
- **Status Codes**: 200: Success

## Data Models

### CreateAccessGrantDto
```typescript
{
  granteeId: string;      // UUID of provider
  recordIds: string[];    // Array of medical record UUIDs
  accessLevel: 'READ' | 'READ_WRITE';
  expiresAt?: string;     // ISO 8601 date string
}
```

### AccessLevel Enum
- `READ`: View-only access
- `READ_WRITE`: Full read and write access

### GrantStatus Enum
- `ACTIVE`: Grant is currently active
- `REVOKED`: Grant has been revoked by patient
- `EXPIRED`: Grant has expired

## Business Logic

### Duplicate Grant Check
The system prevents duplicate active grants for the same patient/grantee/record combination. If an active grant already exists, a 409 Conflict error is returned.

### Grant Lifecycle
1. **Grant**: Patient creates access grant → Status: ACTIVE
2. **Verify**: Grant appears in patient's grants list and provider's received list
3. **Revoke**: Patient revokes access → Status: REVOKED

## Integration Points

### Soroban Blockchain (TODO)
- Grant creation dispatches transaction via BullMQ
- Revocation dispatches transaction via BullMQ
- Transaction hash stored in `sorobanTxHash` field

### WebSocket Events (TODO)
- Grant created event
- Grant revoked event
- Grant expired event

## Testing

Run integration tests:
```bash
npm run test:e2e -- access-grant-lifecycle.e2e-spec.ts
```

## Database Migration

Run migration to create the `access_grants` table:
```bash
npm run migration:run
```

## Security Considerations

- All endpoints require authentication
- Patient can only revoke their own grants
- Provider can only view grants they've received
- Expired grants are automatically filtered from active lists
