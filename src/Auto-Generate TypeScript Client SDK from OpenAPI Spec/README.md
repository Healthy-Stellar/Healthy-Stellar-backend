# @medchain/sdk

> Official TypeScript SDK for the MedChain API — auto-generated from [`docs/openapi.json`](../../docs/openapi.json).

[![npm version](https://img.shields.io/npm/v/@medchain/sdk.svg)](https://www.npmjs.com/package/@medchain/sdk)
[![CI](https://github.com/medchain/medchain/actions/workflows/ci.yml/badge.svg)](https://github.com/medchain/medchain/actions/workflows/ci.yml)

## Installation

```bash
npm install @medchain/sdk
# or
yarn add @medchain/sdk
# or
pnpm add @medchain/sdk
```

**Peer dependency:** `axios ^1.6.0` is included automatically.

---

## Authentication

All API calls (except `auth.login` and `auth.refreshToken`) require a valid JWT bearer token.

### Using `MedChainClient` (recommended)

`MedChainClient` is a convenience wrapper around all API classes that handles token management in one place.

```ts
import { MedChainClient } from '@medchain/sdk';

const client = new MedChainClient({
  basePath: 'https://api.medchain.io/v1', // default — can be omitted
});

// Authenticate
const { data } = await client.auth.login({
  username: 'alice@hospital.org',
  password: 'super_secret',
});

// Attach token to all subsequent requests
client.setToken(data.token!);
```

### Refreshing tokens

```ts
const { data: refreshed } = await client.auth.refreshToken({
  refreshToken: '<your-refresh-token>',
});
client.setToken(refreshed.token!);
```

### Using individual API classes directly

Each API class accepts a `Configuration` object:

```ts
import { RecordsApi, Configuration } from '@medchain/sdk';

const config: Configuration = {
  basePath: 'https://api.medchain.io/v1',
  accessToken: 'eyJhbGciOi...', // static token
  // or a function for dynamic tokens:
  // accessToken: () => tokenStore.get(),
};

const recordsApi = new RecordsApi(config);
```

---

## API Classes

### `AuthApi`

| Method | Description |
|---|---|
| `login(request)` | Exchange credentials for a JWT |
| `refreshToken(request)` | Obtain a new token using a refresh token |
| `logout()` | Invalidate the current bearer token |

```ts
// Login
const { data: session } = await client.auth.login({
  username: 'nurse@hospital.org',
  password: 'password123',
});
client.setToken(session.token!);

// Logout
await client.auth.logout();
```

---

### `RecordsApi`

| Method | Description |
|---|---|
| `listRecords(params?)` | Paginated list of accessible records |
| `uploadRecord(file, patientId, metadata)` | Upload a new record with a file attachment |
| `getRecord(recordId)` | Fetch a single record by ID |
| `deleteRecord(recordId)` | Soft-delete a record |
| `downloadRecord(recordId)` | Download the raw file (returns `ArrayBuffer`) |

```ts
// List records filtered by patient
const { data: page } = await client.records.listRecords({
  patientId: 'patient-uuid-1234',
  recordType: 'LAB_RESULT',
  page: 1,
  pageSize: 20,
});
console.log(`Found ${page.total} records`);
page.data?.forEach(r => console.log(r.id, r.metadata?.title));

// Upload a record (Node.js)
import * as fs from 'fs';
import { RecordMetadata } from '@medchain/sdk';

const file = fs.readFileSync('./lab-result.pdf');
const metadata: RecordMetadata = {
  recordType: 'LAB_RESULT',
  title: 'CBC Panel – 2026-02-21',
  tags: ['cbc', 'routine'],
};

const { data: record } = await client.records.uploadRecord(
  file,
  'patient-uuid-1234',
  JSON.stringify(metadata)
);
console.log('Created record:', record.id, 'IPFS CID:', record.ipfsCid);

// Download file
const { data: buffer } = await client.records.downloadRecord(record.id!);
fs.writeFileSync('./downloaded.pdf', Buffer.from(buffer));
```

---

### `AccessApi`

| Method | Description |
|---|---|
| `listGrants(params?)` | List access grants for the current user |
| `grantAccess(request)` | Grant another user access to a record |
| `revokeAccess(grantId)` | Revoke an existing grant |

```ts
import { GrantAccessRequest, Permission } from '@medchain/sdk';

// Grant a doctor READ access, expiring in 30 days
const request: GrantAccessRequest = {
  recordId: 'record-uuid-abcd',
  granteeId: 'doctor-uuid-5678',
  permissions: ['READ'] as Permission[],
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

const { data: grant } = await client.access.grantAccess(request);
console.log('Grant ID:', grant.id, '| Expires:', grant.expiresAt);

// List all grants for a record
const { data: grants } = await client.access.listGrants({
  recordId: 'record-uuid-abcd',
});

// Revoke a grant
await client.access.revokeAccess(grant.id!);
```

---

### `AuditApi`

| Method | Description |
|---|---|
| `listAuditLogs(params?)` | Retrieve paginated audit trail logs |

```ts
// Audit logs for a specific record over the past 7 days
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const { data: logs } = await client.audit.listAuditLogs({
  resourceId: 'record-uuid-abcd',
  from: sevenDaysAgo,
  pageSize: 50,
});

logs.data?.forEach(log => {
  console.log(`[${log.timestamp}] ${log.actorId} → ${log.action}`);
});
```

---

## Error Handling

All methods return Axios promises. Non-2xx responses throw an `AxiosError`:

```ts
import { AxiosError } from 'axios';
import { ErrorResponse } from '@medchain/sdk';

try {
  await client.records.getRecord('nonexistent-id');
} catch (err) {
  if (err instanceof AxiosError) {
    const apiError = err.response?.data as ErrorResponse;
    console.error(`API Error ${apiError.statusCode}: ${apiError.message}`);
  }
}
```

---

## SDK Generation

This SDK is auto-generated from [`docs/openapi.json`](../../docs/openapi.json) using
[openapi-generator-cli](https://github.com/OpenAPITools/openapi-generator-cli).

```bash
# Regenerate from the latest spec
npm run generate

# Check for drift between spec and committed SDK (used in CI)
npm run generate:check
```

> **Do not edit files in `src/generated/` manually.** They will be overwritten on the next `npm run generate` run.

---

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md). To regenerate the SDK after updating `docs/openapi.json`:

```bash
cd packages/sdk
npm run generate
git add src/generated
git commit -m "chore(sdk): regenerate from updated OpenAPI spec"
```
