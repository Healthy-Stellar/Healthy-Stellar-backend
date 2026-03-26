# OIDC / OAuth2 SSO Module — Healthy-Stellar Backend

Implements hospital staff authentication via existing OIDC/OAuth2 identity providers (Azure AD, Okta, etc.) in addition to Stellar wallet-based auth.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Hospital Browser / Mobile                                           │
│                                                                     │
│  GET /auth/oidc/azure          →  redirect to Azure AD login page   │
│  POST /auth/oidc/azure/callback ←  code exchange → JWT issued       │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┐
│  OidcModule                      │
│  ├── OidcClientRegistry          │  holds one openid-client per IdP
│  ├── OidcStrategy (Passport)     │  validates callback, builds profile
│  ├── OidcService                 │  account linking, JWT issuance
│  └── OidcController             │  HTTP endpoints
└──────────────────────────────────┘

┌────────────────────────────────────────────┐
│  DB                                         │
│  users            (id, email, stellarAddress, …)
│  oidc_identities  (provider, provider_subject, user_id, …)
└────────────────────────────────────────────┘
```

---

## Files

| File | Purpose |
|---|---|
| `oidc.config.ts` | Reads provider configs from env vars |
| `oidc.strategy.ts` | `OidcClientRegistry` + `OidcStrategy` (Passport) |
| `oidc.service.ts` | Business logic: login, linking, JWT |
| `oidc.controller.ts` | HTTP routes |
| `oidc.module.ts` | NestJS wiring |
| `entities/oidc-identity.entity.ts` | TypeORM entity |
| `dto/oidc.dto.ts` | Request/response DTOs |
| `guards/oidc-auth.guard.ts` | Passport guard |
| `migrations/…CreateOidcIdentities.ts` | DB migration |
| `oidc.service.spec.ts` | Unit tests — service |
| `oidc.strategy.spec.ts` | Unit tests — strategy |

---

## Setup

### 1. Install dependencies

```bash
npm install openid-client passport-custom passport @nestjs/passport
npm install --save-dev @types/passport
```

### 2. Environment variables

```env
# Comma-separated list of provider keys
OIDC_PROVIDERS=azure,okta

# Azure AD
OIDC_AZURE_ISSUER=https://login.microsoftonline.com/{TENANT_ID}/v2.0
OIDC_AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
OIDC_AZURE_CLIENT_SECRET=your-client-secret
OIDC_AZURE_REDIRECT_URI=https://api.hospital.com/auth/oidc/azure/callback
OIDC_AZURE_SCOPE=openid profile email                  # optional

# Okta
OIDC_OKTA_ISSUER=https://hospital.okta.com/oauth2/default
OIDC_OKTA_CLIENT_ID=...
OIDC_OKTA_CLIENT_SECRET=...
OIDC_OKTA_REDIRECT_URI=https://api.hospital.com/auth/oidc/okta/callback

# JWT
JWT_SECRET=your-super-secret
JWT_EXPIRES_IN=8h

# Stellar
STELLAR_NETWORK=testnet          # or mainnet

# After OIDC login, redirect frontend here
FRONTEND_URL=https://app.hospital.com
```

### 3. Import the module

```typescript
// app.module.ts
import { OidcModule } from './auth/oidc/oidc.module';

@Module({
  imports: [
    OidcModule,
    // …
  ],
})
export class AppModule {}
```

### 4. Session middleware (required for state/nonce storage)

```typescript
// main.ts
import * as session from 'express-session';

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, httpOnly: true, sameSite: 'lax' },
  }),
);
```

### 5. Run migration

```bash
npm run typeorm migration:run
```

---

## Endpoints

| Method | Path | Auth required | Description |
|---|---|---|---|
| `GET` | `/auth/oidc/providers` | — | List configured provider names |
| `GET` | `/auth/oidc/:provider` | — | Initiate OIDC login flow (redirects to IdP) |
| `GET` | `/auth/oidc/:provider/callback` | — | IdP callback (GET variant, e.g. Azure) |
| `POST` | `/auth/oidc/:provider/callback` | — | IdP callback (POST variant) |
| `GET` | `/auth/oidc/link/:provider` | JWT | Initiate identity linking to existing Stellar account |
| `POST` | `/auth/oidc/link/:provider/callback` | JWT | Complete identity linking |
| `POST` | `/auth/oidc/link-stellar` | JWT | Bind a Stellar address to OIDC account |
| `GET` | `/auth/oidc/identities` | JWT | List linked OIDC identities |
| `DELETE` | `/auth/oidc/identities/:id` | JWT | Unlink an OIDC identity |

---

## Account Linking Logic

```
OIDC Callback received
      │
      ▼
OidcIdentity exists? ──Yes──► update lastUsedAt → issue JWT
      │ No
      ▼
User with matching email exists? ──Yes──► link identity to user → issue JWT
      │ No
      ▼
Create new User + OidcIdentity → issue JWT (isNewUser: true)
```

After first login, a user without a Stellar address can call `POST /auth/oidc/link-stellar` with a signed SEP-10 challenge to bind their wallet.

---

## JWT Payload

```json
{
  "sub": "internal-user-uuid",
  "email": "doctor@hospital.org",
  "stellarAddress": "GABC...1234",
  "oidcProvider": "azure",
  "iat": 1710000000,
  "exp": 1710028800
}
```

---

## Security Notes

- **PKCE** (S256) is used on every authorization request.
- **State + nonce** are stored server-side in the session and validated on callback to prevent CSRF.
- Access tokens from the IdP are **never stored** — only `rawClaims` from the id_token for audit purposes.
- Stellar address binding requires a valid **signed SEP-10 challenge** proving key ownership.
- Unlinking the last authentication method is blocked unless a Stellar address is present.

---

## Running Tests

```bash
# Unit tests only
npx jest oidc --testPathPattern='oidc\.(service|strategy)\.spec'

# With coverage
npx jest --coverage --testPathPattern='oidc'
```
