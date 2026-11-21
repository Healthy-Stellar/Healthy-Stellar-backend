# GraphQL API

Healthy Stellar exposes a GraphQL endpoint powered by Apollo Server (NestJS driver) with
support for queries, mutations, real-time subscriptions, DataLoader batching, and Automatic
Persisted Queries (APQ).

## Table of Contents

- [Endpoint & Playground](#endpoint--playground)
- [Authentication](#authentication)
  - [HTTP requests](#http-requests)
  - [WebSocket subscriptions](#websocket-subscriptions)
- [Queries](#queries)
- [Mutations](#mutations)
- [Subscriptions](#subscriptions)
  - [Client connection example](#client-connection-example)
  - [Subscription limits](#subscription-limits)
- [Query protection](#query-protection)
  - [Complexity budget](#complexity-budget)
  - [Depth limit](#depth-limit)
- [Automatic Persisted Queries (APQ)](#automatic-persisted-queries-apq)
- [DataLoaders](#dataloaders)
- [Schema](#schema)
- [Code generation](#code-generation)

---

## Endpoint & Playground

| Environment | HTTP endpoint | WebSocket endpoint |
|-------------|---------------|--------------------|
| All | `POST /graphql` | `ws://<host>/graphql` |
| Non-production only | GET `/graphql` (Apollo Sandbox / Playground) | — |

The playground and introspection are **disabled in production** (`NODE_ENV=production`).

---

## Authentication

All queries and mutations require a valid JWT access token obtained from the REST auth
endpoint (`POST /auth/login`).

### HTTP requests

Pass the token as a `Bearer` header on every request:

```http
POST /graphql HTTP/1.1
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "query": "{ me { id email } }"
}
```

### WebSocket subscriptions

Pass the token in the `connectionParams` payload sent by the WebSocket client during the
connection handshake:

```json
{
  "authorization": "Bearer <access_token>"
}
```

Accepted key names: `authorization`, `Authorization`, or `authToken`. The server strips the
`Bearer ` prefix automatically.

The server validates the token **and** the active session on every new connection. The
connection is rejected (with `UNAUTHENTICATED`) if:

- the token is missing or malformed,
- the token is expired or invalid,
- the session has been revoked.

All connection attempts (success and failure) are written to the audit log.

---

## Queries

All queries require authentication unless noted otherwise.

| Operation | Description | Roles |
|-----------|-------------|-------|
| `me` | Authenticated user's full profile | any |
| `record(id: ID!)` | Single medical record with access check | any |
| `records(filter, pagination)` | Paginated list (Relay cursor style) | any |
| `accessGrants(patientId, status)` | List access grants | PATIENT, ADMIN |
| `auditLog(resourceId, pagination)` | Paginated audit trail for a resource | PATIENT, ADMIN |
| `provider(id: ID!)` | Public provider profile | any |
| `providers(search, specialty)` | Provider directory search | any |

### Sample — fetch current user and recent records

```graphql
query MeAndRecords {
  me {
    id
    email
    role
  }
  records(pagination: { first: 10 }) {
    edges {
      node {
        id
        title
        recordType
        status
        createdAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Sample — single record with audit trail

```graphql
query RecordDetail($id: ID!) {
  record(id: $id) {
    id
    title
    recordType
    status
    stellarTxHash
    patient {
      id
      email
    }
    auditLog(pagination: { first: 5 }) {
      edges {
        node {
          id
          action
          createdAt
          actor {
            id
            email
          }
        }
      }
    }
  }
}
```

---

## Mutations

All mutations require authentication. Mutations return union payloads so the client can
distinguish between success and typed error variants without relying on HTTP status codes.

| Operation | Description | Input type |
|-----------|-------------|------------|
| `uploadRecord(input)` | Upload a new medical record | `UploadRecordInput` |
| `grantAccess(input)` | Grant a provider access to a record | `GrantAccessInput` |
| `revokeAccess(grantId)` | Revoke an access grant | `ID!` |
| `updateProfile(input)` | Update authenticated user's profile | `UpdateProfileInput` |
| `registerDevice(input)` | Register device for push notifications | `RegisterDeviceInput` |
| `submitGdprRequest(type)` | Submit a GDPR data request | `GdprRequestType` |

All write operations that could be retried accept an optional `idempotencyKey: String`
field in the input. Sending the same key twice within the idempotency window returns the
cached response without re-executing the operation.

### Sample — upload a record

```graphql
mutation UploadRecord($input: UploadRecordInput!) {
  uploadRecord(input: $input) {
    ... on UploadRecordSuccess {
      record {
        id
        title
        status
        stellarTxHash
      }
      jobId
      status
    }
    ... on ValidationError {
      message
      fieldErrors {
        field
        message
      }
    }
    ... on StellarTransactionError {
      message
      txHash
      errorCode
    }
    ... on UnauthorizedError {
      message
    }
  }
}
```

### Sample — grant and revoke access

```graphql
mutation GrantAccess($input: GrantAccessInput!) {
  grantAccess(input: $input) {
    ... on AccessGrantSuccess {
      grant {
        id
        providerId
        expiresAt
      }
    }
    ... on NotFoundError {
      message
    }
    ... on UnauthorizedError {
      message
    }
  }
}

mutation RevokeAccess($grantId: ID!) {
  revokeAccess(grantId: $grantId) {
    ... on RevokeAccessSuccess {
      grantId
      revoked
    }
  }
}
```

---

## Subscriptions

Subscriptions use the [graphql-ws](https://the-guild.dev/graphql/ws) protocol over a
standard WebSocket connection. The legacy `subscriptions-transport-ws` protocol is **not**
supported.

| Subscription | Arguments | Payload | Description |
|--------------|-----------|---------|-------------|
| `onNewRecord` | `patientAddress: String!` | `MedicalRecord` | Fires when a new record is created for the patient |
| `onAccessChanged` | `patientAddress: String!` | `AccessGrant` | Fires when access is granted or revoked for the patient |

A `keepAlive` ping is sent every **10 seconds** to keep the connection alive through
proxies and load balancers.

### Client connection example

The example below uses the `graphql-ws` npm package (the same library the server uses):

```typescript
import { createClient } from 'graphql-ws';
import WebSocket from 'ws'; // Node.js; browsers use the global WebSocket

const client = createClient({
  url: 'ws://localhost:3000/graphql',
  webSocketImpl: WebSocket, // omit in browsers
  connectionParams: {
    // Use either of these key names; the server accepts all three:
    //   authorization | Authorization | authToken
    authorization: `Bearer ${accessToken}`,
  },
});

// Subscribe to new records for a patient
const unsubscribe = client.subscribe(
  {
    query: `
      subscription OnNewRecord($patientAddress: String!) {
        onNewRecord(patientAddress: $patientAddress) {
          id
          title
          recordType
          status
          createdAt
        }
      }
    `,
    variables: { patientAddress: '0xABC...123' },
  },
  {
    next: (data) => console.log('New record:', data),
    error: (err) => console.error('Subscription error:', err),
    complete: () => console.log('Subscription completed'),
  },
);

// Later — clean up
unsubscribe();
```

### Subscription limits

The following environment variables control subscription behaviour. All are optional;
defaults are shown.

| Variable | Default | Description |
|----------|---------|-------------|
| `SUBSCRIPTIONS_IDLE_TIMEOUT_MS` | `300000` (5 min) | Milliseconds of inactivity before the server closes an idle connection |
| `SUBSCRIPTIONS_MAX_PER_CONNECTION` | `10` | Maximum concurrent subscriptions per WebSocket connection |
| `SUBSCRIPTIONS_SWEEP_INTERVAL_MS` | `60000` (1 min) | Interval at which the server sweeps for stale connections |

When `SUBSCRIPTIONS_MAX_PER_CONNECTION` is exceeded the server rejects the new connection
with `FORBIDDEN: subscription connection limit reached`.

---

## Query protection

### Complexity budget

Every incoming GraphQL operation is scored by
[`graphql-query-complexity`](https://github.com/slicknode/graphql-query-complexity). If
the score exceeds the configured threshold the request is rejected **before** any resolver
is called and an audit log entry is written.

| Variable | Default | Description |
|----------|---------|-------------|
| `GRAPHQL_QUERY_COMPLEXITY_THRESHOLD` | `150` | Maximum allowed complexity score per operation |

Per-tenant tighter limits can be configured via `TenantConfigService` (key:
`graphql_max_query_complexity`); a tenant override can only reduce the ceiling, never
raise it above the environment-wide value.

Error response when exceeded:

```json
{
  "errors": [{
    "message": "Query complexity 210 exceeds maximum allowed complexity of 150. ...",
    "extensions": {
      "code": "GRAPHQL_QUERY_COMPLEXITY_EXCEEDED",
      "complexity": 210,
      "threshold": 150
    }
  }]
}
```

### Depth limit

Query nesting depth is validated during the GraphQL validation phase (before execution).

| Variable | Default | Description |
|----------|---------|-------------|
| `GRAPHQL_MAX_QUERY_DEPTH` | `7` | Maximum allowed selection-set nesting depth |

Per-tenant tighter limits are supported via `TenantConfigService` (key:
`graphql_max_query_depth`).

---

## Automatic Persisted Queries (APQ)

See **[docs/APQ_PERSISTED_QUERIES_ISSUE_676.md](APQ_PERSISTED_QUERIES_ISSUE_676.md)** for
the full APQ implementation reference.

Summary:

- **Production** (`NODE_ENV=production`): every request **must** include
  `extensions.persistedQuery.sha256Hash`. Requests without a hash, or with an unknown /
  mismatched hash, are rejected with `PERSISTED_QUERY_REQUIRED`,
  `PERSISTED_QUERY_NOT_FOUND`, or `PERSISTED_QUERY_MISMATCH`.
- **Development**: persisted query hashes are validated if present but not required; any
  arbitrary query is accepted.
- The query store is Redis-backed (`apq:<sha256hash>` keys with a 30-day TTL).

### Registering queries at deploy time

Run this once against a live Redis instance before each deployment:

```bash
npm run register:graphql-queries
```

This hashes and stores every operation defined in `src/graphql/queries/index.ts` into
Redis. Add it to your CI/CD pipeline or Docker entrypoint so the store is always
up-to-date before the server starts accepting production traffic.

### Production request format

```json
{
  "variables": { "id": "rec_abc123" },
  "extensions": {
    "persistedQuery": {
      "sha256Hash": "<sha256 of the query string>"
    }
  }
}
```

The `query` field is optional in production — the server replaces it with the canonical
stored version, which also prevents query-smuggling attacks.

---

## DataLoaders

To prevent N+1 database queries, field resolvers on `MedicalRecord`, `AccessGrant`, and
`AuditLog` types batch their sub-queries using [DataLoader](https://github.com/graphql/dataloader):

| DataLoader | Batches |
|------------|---------|
| `UserDataLoader` | User lookups by ID (`patient`, `uploadedBy`, `actor`, `provider` fields) |
| `RecordDataLoader` | Access grant lookups keyed by record ID |

DataLoader instances are created per-request (injected into the GraphQL context by
`DataLoaderService`) so batching is scoped to a single operation.

---

## Schema

The canonical schema is auto-generated from the NestJS resolver decorators and written
to `docs/schema.graphql` when the app starts. To regenerate without starting the full
server:

```bash
npm run export:schema
```

Commit `docs/schema.graphql` after any resolver change so it reflects the current API
without needing to boot the app. The recommended CI step:

```yaml
# .github/workflows/ci.yml (excerpt)
- name: Export GraphQL schema
  run: npm run export:schema
- name: Assert schema is up to date
  run: git diff --exit-code docs/schema.graphql
```

---

## Code generation

TypeScript types for all operations and the schema can be generated with:

```bash
npm run generate:graphql-types
```

This runs `graphql-codegen` using `codegen.yml` and outputs typed hooks/documents for
client consumption. Re-run after any schema or query change.
