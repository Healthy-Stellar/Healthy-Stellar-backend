# API Documentation

## Tenant Provisioning API

Base URL: `http://localhost:3000`

### Authentication

All endpoints should include authentication in production. Add the following header:

```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### 1. Create Tenant (Queue Provisioning)

Queues a new tenant provisioning job.

**Method**: `POST`
**Endpoint**: `/admin/tenants`
**Status Code**: `202 Accepted`

#### Request

```bash
curl -X POST http://localhost:3000/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Healthcare Corporation",
    "adminEmail": "admin@acmehc.local",
    "adminFirstName": "John",
    "adminLastName": "Smith"
  }'
```

#### Request Body

```json
{
  "name": "Acme Healthcare Corporation",
  "adminEmail": "admin@acmehc.local",
  "adminFirstName": "John",
  "adminLastName": "Smith"
}
```

**Validation Rules**:

- `name`: String, minimum 3 characters, required
- `adminEmail`: Valid email format, required
- `adminFirstName`: String, required
- `adminLastName`: String, required

#### Response

```json
{
  "jobId": "5",
  "status": "queued",
  "message": "Tenant provisioning for Acme Healthcare Corporation has been queued"
}
```

#### Error Response (400)

```json
{
  "statusCode": 400,
  "message": ["name must be a string", "name must be longer than or equal to 3 characters"],
  "error": "Bad Request"
}
```

#### Error Response (400 - Invalid Email)

```json
{
  "statusCode": 400,
  "message": ["adminEmail must be an email"],
  "error": "Bad Request"
}
```

---

### 2. Get Provisioning Status

Get detailed provisioning status with step-by-step logs.

**Method**: `GET`
**Endpoint**: `/admin/tenants/:id/provisioning-status`
**Status Code**: `200 OK`

#### Request

```bash
curl -X GET http://localhost:3000/admin/tenants/550e8400-e29b-41d4-a716-446655440001/provisioning-status
```

#### Response

```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440001",
  "tenantName": "Acme Healthcare Corporation",
  "overallStatus": "ACTIVE",
  "logs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "step": "CREATE_TENANT_RECORD",
      "status": "COMPLETED",
      "result": null,
      "error": null,
      "durationMs": null,
      "createdAt": "2026-02-21T10:30:00.123Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440011",
      "step": "CREATE_SCHEMA",
      "status": "COMPLETED",
      "result": null,
      "error": null,
      "durationMs": null,
      "createdAt": "2026-02-21T10:30:01.456Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440012",
      "step": "RUN_MIGRATIONS",
      "status": "COMPLETED",
      "result": null,
      "error": null,
      "durationMs": null,
      "createdAt": "2026-02-21T10:30:02.789Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440013",
      "step": "SEED_ROLES_AND_USER",
      "status": "COMPLETED",
      "result": "{\"adminUserId\":\"550e8400-e29b-41d4-a716-446655440020\"}",
      "error": null,
      "durationMs": null,
      "createdAt": "2026-02-21T10:30:03.012Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440014",
      "step": "DEPLOY_SOROBAN_CONTRACT",
      "status": "COMPLETED",
      "result": "contract_550e8400_1708599000000",
      "error": null,
      "durationMs": null,
      "createdAt": "2026-02-21T10:30:04.345Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440015",
      "step": "STORE_CONTRACT_ADDRESS",
      "status": "COMPLETED",
      "result": null,
      "error": null,
      "durationMs": null,
      "createdAt": "2026-02-21T10:30:05.678Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440016",
      "step": "SEND_WELCOME_EMAIL",
      "status": "COMPLETED",
      "result": null,
      "error": null,
      "durationMs": null,
      "createdAt": "2026-02-21T10:30:06.901Z"
    }
  ],
  "createdAt": "2026-02-21T10:30:00.000Z",
  "updatedAt": "2026-02-21T10:30:06.901Z",
  "completedAt": "2026-02-21T10:30:06.901Z"
}
```

#### Response (In Progress)

```json
{
  "tenantId": "550e8400-e29b-41d4-a716-446655440001",
  "tenantName": "Acme Healthcare Corporation",
  "overallStatus": "PROVISIONING",
  "logs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "step": "CREATE_TENANT_RECORD",
      "status": "COMPLETED",
      "createdAt": "2026-02-21T10:30:00.123Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440011",
      "step": "CREATE_SCHEMA",
      "status": "IN_PROGRESS",
      "createdAt": "2026-02-21T10:30:01.456Z"
    }
  ],
  "createdAt": "2026-02-21T10:30:00.000Z",
  "updatedAt": "2026-02-21T10:30:01.456Z",
  "completedAt": null
}
```

#### Error Response (404)

```json
{
  "statusCode": 404,
  "message": "Tenant not found: 00000000-0000-0000-0000-000000000000",
  "error": "Not Found"
}
```

---

### 3. Get Tenant Details

Get tenant information.

**Method**: `GET`
**Endpoint**: `/admin/tenants/:id`
**Status Code**: `200 OK`

#### Request

```bash
curl -X GET http://localhost:3000/admin/tenants/550e8400-e29b-41d4-a716-446655440001
```

#### Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Acme Healthcare Corporation",
  "schemaName": "acme_healthcare_corporation_1708599000000",
  "status": "ACTIVE",
  "adminEmail": "admin@acmehc.local",
  "sorobanContractId": "contract_550e8400_1708599000000",
  "createdAt": "2026-02-21T10:30:00.000Z",
  "updatedAt": "2026-02-21T10:30:06.901Z"
}
```

#### Error Response (404)

```json
{
  "statusCode": 404,
  "message": "Tenant not found: 00000000-0000-0000-0000-000000000000",
  "error": "Not Found"
}
```

---

### 4. List All Tenants

Get a list of all tenants.

**Method**: `GET`
**Endpoint**: `/admin/tenants`
**Status Code**: `200 OK`

#### Request

```bash
curl -X GET http://localhost:3000/admin/tenants
```

#### Response

```json
{
  "total": 3,
  "tenants": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Acme Healthcare Corporation",
      "status": "ACTIVE",
      "adminEmail": "admin@acmehc.local",
      "createdAt": "2026-02-21T10:30:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "name": "Blue Cross Healthcare",
      "status": "FAILED",
      "adminEmail": "admin@bchealth.local",
      "createdAt": "2026-02-21T10:15:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "name": "Community Health Network",
      "status": "PROVISIONING",
      "adminEmail": "admin@chn.local",
      "createdAt": "2026-02-21T11:00:00.000Z"
    }
  ]
}
```

---

### 5. Archive Tenant (Soft Delete)

Archive (deprovision) a tenant. This soft-deletes the tenant without permanently removing data.

**Method**: `DELETE`
**Endpoint**: `/admin/tenants/:id`
**Status Code**: `200 OK`

#### Request

```bash
curl -X DELETE http://localhost:3000/admin/tenants/550e8400-e29b-41d4-a716-446655440001
```

#### Response

```json
{
  "status": "archived",
  "message": "Tenant 550e8400-e29b-41d4-a716-446655440001 has been archived"
}
```

#### Error Response (404)

```json
{
  "statusCode": 404,
  "message": "Tenant not found: 00000000-0000-0000-0000-000000000000",
  "error": "Not Found"
}
```

---

## Status Codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| 200  | OK - Request succeeded               |
| 202  | Accepted - Job queued successfully   |
| 400  | Bad Request - Invalid input          |
| 404  | Not Found - Resource not found       |
| 500  | Internal Server Error - Server error |

---

## Provisioning Steps

The provisioning pipeline executes these steps in order:

1. **CREATE_TENANT_RECORD**: Creates tenant in public schema
2. **CREATE_SCHEMA**: Creates PostgreSQL schema for tenant
3. **RUN_MIGRATIONS**: Runs database migrations
4. **SEED_ROLES_AND_USER**: Creates default roles and admin user
5. **DEPLOY_SOROBAN_CONTRACT**: Deploys blockchain contract
6. **STORE_CONTRACT_ADDRESS**: Stores contract ID on tenant record
7. **SEND_WELCOME_EMAIL**: Sends welcome email to admin

---

## Provisioning Statuses

- **PENDING**: Waiting to start
- **IN_PROGRESS**: Currently executing
- **COMPLETED**: Step completed successfully
- **FAILED**: Step failed
- **ROLLED_BACK**: Step rolled back due to error

---

## Tenant Statuses

- **PENDING**: Initial state, waiting for provisioning to start
- **PROVISIONING**: Provisioning job is running
- **ACTIVE**: Provisioning completed successfully
- **FAILED**: Provisioning encountered an error
- **ARCHIVED**: Tenant has been deprovisioned/archived

---

## Example Workflows

### Successful Provisioning

```
1. POST /admin/tenants
   Response: 202 Accepted with jobId

2. GET /admin/tenants/{tenantId}/provisioning-status
   Response: 200 OK with status PROVISIONING
   (Poll this until status becomes ACTIVE)

3. GET /admin/tenants/{tenantId}
   Response: 200 OK with tenant details and contract ID
```

### Provisioning Failure

```
1. POST /admin/tenants
   Response: 202 Accepted with jobId

2. GET /admin/tenants/{tenantId}/provisioning-status
   Response: 200 OK with status FAILED
   - After some steps, contains FAILED and error message

3. Admin receives error email notification

4. Schema is automatically rolled back
```

### Tenant Archival

```
1. DELETE /admin/tenants/{tenantId}
   Response: 200 OK

2. GET /admin/tenants/{tenantId}
   Response: Tenant status is now ARCHIVED
   Response: archivedAt timestamp is set
```

---

## Error Examples

### Missing Required Field

```
curl -X POST http://localhost:3000/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Org"}'
```

Response (400):

```json
{
  "statusCode": 400,
  "message": [
    "adminEmail should not be empty",
    "adminFirstName should not be empty",
    "adminLastName should not be empty"
  ],
  "error": "Bad Request"
}
```

### Invalid Email Format

```
curl -X POST http://localhost:3000/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Org",
    "adminEmail": "not-an-email",
    "adminFirstName": "John",
    "adminLastName": "Doe"
  }'
```

Response (400):

```json
{
  "statusCode": 400,
  "message": ["adminEmail must be an email"],
  "error": "Bad Request"
}
```

### Name Too Short

```
curl -X POST http://localhost:3000/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AB",
    "adminEmail": "admin@test.local",
    "adminFirstName": "John",
    "adminLastName": "Doe"
  }'
```

Response (400):

```json
{
  "statusCode": 400,
  "message": ["name must be longer than or equal to 3 characters"],
  "error": "Bad Request"
}
```
