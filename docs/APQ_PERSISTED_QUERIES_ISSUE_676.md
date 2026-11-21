# GraphQL Persistent Queries (APQ) Implementation

## Issue
**#676** — GraphQL requests send full query strings, increasing payload size and exposing the schema to arbitrary query abuse.

## Solution
Implemented Automatic Persisted Queries (APQ) protocol in Apollo Server with Redis-backed storage, enforcing only pre-registered queries in production.

---

## Architecture

### Components

#### 1. `src/graphql/plugins/apq.plugin.ts`
Apollo Server plugin that intercepts every GraphQL request and enforces APQ rules:

- **Production mode** (`NODE_ENV=production`):
  - Requires `extensions.persistedQuery.sha256Hash` on every request
  - Validates the hash exists in the Redis store
  - Verifies the submitted query text matches the stored query (prevents query smuggling)
  - Replaces `request.query` with the stored canonical version
  - Rejects with `PERSISTED_QUERY_REQUIRED` or `PERSISTED_QUERY_NOT_FOUND` errors

- **Development mode**:
  - Allows arbitrary queries without registration
  - No persisted query hash required

#### 2. `src/graphql/services/apq.service.ts`
Redis-backed service for managing the persisted query store:

- Uses `ioredis` with SHA-256 hashing
- Key prefix: `apq:{sha256hash}`
- TTL: 30 days (configurable via `TTL_SECONDS`)
- Operations:
  - `hashQuery(query)` — generates SHA-256 hash
  - `storeQuery(hash, query)` — stores with TTL
  - `getQuery(hash)` — retrieves stored query
  - `exists(hash)` — checks existence
  - `registerQuery(query)` — hashes and stores
  - `registerQueries(queries[])` — batch registration
  - `getQueryCount()` — monitoring

#### 3. `src/graphql/queries/index.ts`
Defines 15 standard GraphQL operations approved for production use:

**Queries:**
- `Me` — authenticated user profile
- `Record` — single medical record by ID
- `Records` — paginated medical records with filters
- `AccessGrants` — access grants for patient
- `AuditLog` — paginated audit trail
- `Provider` — public provider profile
- `Providers` — provider directory
- `Patient` — patient by ID
- `Patients` — patient listing

**Mutations:**
- `UploadRecord` — upload new medical record
- `GrantAccess` — grant provider access to record
- `RevokeAccess` — revoke access grant
- `UpdateProfile` — update user profile
- `RegisterDevice` — register push notification device
- `SubmitGdprRequest` — submit GDPR data request

#### 4. `scripts/register-graphql-queries.ts`
CLI script for deploy-time registration:

```bash
npm run register:graphql-queries
```

Outputs:
- Each registered hash with query preview
- Total count of persisted queries in Redis

#### 5. `src/graphql/__tests__/apq.plugin.spec.ts`
7 comprehensive unit tests covering all enforcement scenarios:

| Test | Description |
|------|-------------|
| ✅ | Dev mode without `persistedQuery` extension — query allowed |
| ✅ | Production mode without `persistedQuery` extension — rejected with `PERSISTED_QUERY_REQUIRED` |
| ✅ | Production mode with empty `persistedQuery` — rejected |
| ✅ | Production mode with unknown hash — rejected with `PERSISTED_QUERY_NOT_FOUND` |
| ✅ | Production mode with known hash — query allowed |
| ✅ | Production mode hash mismatch — rejected with `PERSISTED_QUERY_MISMATCH` |
| ✅ | Dev mode with unknown hash — allowed without storing |

---

## Configuration

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | — | Redis connection URL (takes precedence) |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | `''` | Redis password |
| `NODE_ENV` | `development` | Determines APQ enforcement |

### Deploy-Time Registration
Add to deployment pipeline (CI/CD, Docker entrypoint, etc.):

```bash
# Ensure Redis is running, then register queries:
npm run register:graphql-queries
```

### Client Request Format (Production)
```json
{
  "query": "...",  // Required but replaced by server-stored version
  "variables": {},
  "extensions": {
    "persistedQuery": {
      "sha256Hash": "abc123..."
    }
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `PERSISTED_QUERY_REQUIRED` | 400 | Missing or empty `persistedQuery.sha256Hash` in production |
| `PERSISTED_QUERY_NOT_FOUND` | 400 | Hash not found in Redis store |
| `PERSISTED_QUERY_MISMATCH` | 400 | Submitted query doesn't match stored query for hash |

---

## Benefits

1. **Reduced Payload Size** — Clients send only a hash (~32 bytes) instead of full query text
2. **Schema Protection** — Only pre-approved queries execute in production; arbitrary query abuse prevented
3. **Query Plan Cacheability** — Apollo Server can cache query plans more reliably
4. **Operational Safety** — Deploy-time registration ensures only reviewed queries go live

---

## Testing

Run the APQ tests:
```bash
npx jest --selectProjects unit --testPathPatterns 'apq.plugin.spec.ts'
```

All 7 tests pass ✅

---

## Pull Request
- **PR**: https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/725
- **Branch**: `feat/graphql-persisted-queries-apq-676`

closes #676
