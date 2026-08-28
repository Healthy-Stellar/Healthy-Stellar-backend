# @medchain/sdk

Auto-generated TypeScript SDK for the MedChain Healthcare API — a
blockchain-based medical records management API built on
[Healthy-Stellar-backend](https://github.com/Healthy-Stellar/Healthy-Stellar-backend).

## Installation

```bash
npm install @medchain/sdk
```

`axios` is a peer dependency (`^1.x`) — install it alongside the SDK if your
project doesn't already depend on it:

```bash
npm install axios
```

## Quick start

```ts
import { AuthApi, RecordsApi, AccessApi, Configuration } from '@medchain/sdk';

const config = new Configuration({ basePath: 'https://api.medchain.io/v1' });

const authApi = new AuthApi(config);
const { accessToken } = await authApi.register({
  email: 'patient@example.com',
  password: 'SecurePassword123!',
  name: 'John Doe',
  role: 'patient',
});

// Requests that need auth take their own Configuration with the token set.
const recordsApi = new RecordsApi(
  new Configuration({ accessToken, basePath: config.getBasePath() }),
);
const record = await recordsApi.createRecord({
  patientId: 'patient-001',
  recordType: 'LAB_RESULT',
  data: { testName: 'Complete Blood Count' },
});
```

See [`examples/complete-flow.ts`](examples/complete-flow.ts) for a full,
runnable walkthrough — registering a patient and a provider, creating a
record, granting and verifying access, fetching the record as the provider,
and revoking access again. Run it with:

```bash
API_BASE_URL=http://localhost:3000/v1 npx ts-node examples/complete-flow.ts
```

## API surface

| Export | Purpose |
|---|---|
| `AuthApi` | `register`, login/token flows (`LoginRequest`, `TokenResponse`, `RefreshTokenRequest`) |
| `RecordsApi` | `createRecord`, `getRecord`, and related types (`CreateRecordRequest`, `RecordResponse`, `ListRecordsResponse`) |
| `AccessApi` | `grantAccess`, `listAccessGrants`, `revokeAccess`, and related types (`GrantAccessRequest`, `AccessGrant`, `ListAccessGrantsResponse`) |
| `Configuration` | Holds `basePath`, `apiKey`, and `accessToken` (each may be a static value or a function/async function, re-evaluated per request) |
| `./models` | Shared request/response model types |
| `./graphql` | GraphQL TypeScript types generated from the backend's `docs/schema.graphql` via `npm run generate:graphql-types` (see that script's own docs for regenerating after a schema change) |

Every API class also accepts a scoped import if you only need one surface,
e.g. `import { RecordsApi } from '@medchain/sdk/apis'` or
`import type { UserInfo } from '@medchain/sdk/models'` — see the `exports`
map in [`package.json`](package.json).

## Configuration

```ts
new Configuration({
  basePath: 'https://api.medchain.io/v1', // defaults to this if omitted
  accessToken: 'jwt-or-a-()-=>-string-fn',
  apiKey: 'static-key-or-a-()-=>-string-fn',
  baseOptions: { /* passed through to the underlying axios instance */ },
});
```

`accessToken` may also be an async function (`() => Promise<string>`), which
is re-invoked on each request — useful for wiring in a token refresh
callback instead of updating `Configuration` by hand.

## Building from source

This package lives at `packages/sdk` in the
[Healthy-Stellar-backend](https://github.com/Healthy-Stellar/Healthy-Stellar-backend)
monorepo and is not maintained as a standalone repository.

```bash
cd packages/sdk
npm run build   # tsc — emits dist/
npm run clean   # rm -rf dist
```

`prepack` runs the build automatically before `npm publish`/`npm pack`.

## License

ISC — see [LICENSE](LICENSE).
