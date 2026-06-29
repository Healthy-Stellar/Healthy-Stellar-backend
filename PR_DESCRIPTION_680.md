# SMART on FHIR Authorization Server for Third-Party App Launch

## Summary

Implements the SMART on FHIR authorization framework enabling third-party clinical applications to launch in context (patient, encounter) via the EHR launch sequence.

## Acceptance Criteria

### ✅ `/.well-known/smart-configuration` Discovery Endpoint
- **File**: `src/OAuth2/smart.controller.ts`
- Returns SMART on FHIR configuration document with:
  - `authorization_endpoint` and `token_endpoint` URLs
  - `scopes_supported`: openid, fhirUser, launch/patient, patient/*.read, patient/*.write, patient/*.*, user/*.read, user/*.write, user/*.*, offline_access
  - `capabilities`: launch-ehr, launch-standalone, client-public, client-confidential-symmetric, sso-openid-connect, context-passthrough-*, context-ehr-patient, context-ehr-encounter, context-standalone-patient, permission-*, smart-style-url
  - `response_types_supported`: code
  - `code_challenge_methods_supported`: S256

### ✅ EHR Launch Sequence
- **File**: `src/OAuth2/oauth2.controller.ts`
- `GET /oauth2/authorize` accepts `launch` parameter from the EHR
- Launches the third-party app with the launch context encoded in the authorization code
- Supports `launch/patient` scope for patient context resolution
- Protected by `JwtAuthGuard` — requires a pre-existing authenticated session

### ✅ OAuth2 Authorization Flow with SMART Clinical Scopes
- **File**: `src/OAuth2/oauth2.controller.ts`
- Authorization code flow with PKCE (S256 code challenge method)
- Scope filtering: only SMART-relevant scopes (`patient/*`, `user/*`, `launch/patient`, `openid`, `fhirUser`) are included in the access token
- `POST /oauth2/token` exchanges authorization code for access token with scope validation
- `fhirUser` claim included in token when `fhirUser` scope is requested

### ✅ `launch/patient` Context
- **File**: `src/OAuth2/oauth2.controller.ts` (lines 123-133)
- When `launch/patient` scope is present, the token response includes the `patient` field with the current patient ID
- Patient ID is resolved from the `userId` associated with the authorization code
- Returns 401 if no patient record is linked to the user

### ✅ PKCE Authorization Code Support
- **File**: `src/OAuth2/pkce.service.ts`
- In-memory authorization code store with 10-minute TTL
- S256 PKCE challenge verification
- One-time use codes with client_id and redirect_uri validation
- Supports SMART launch context storage with the authorization code

### ✅ E2E Tests
- **File**: `test/e2e/smart-on-fhir.e2e-spec.ts`
- Tests `GET /.well-known/smart-configuration` discovery endpoint
- Tests full SMART EHR Launch flow:
  - User registration and patient record creation
  - Authorization code issuance with launch param and PKCE
  - Token exchange with `launch/patient` context resolution
  - `fhirUser` scope inclusion
- Tests error cases: unsupported `response_type`, invalid `grant_type`

## Module Changes

- `src/OAuth2/oidc.module.ts` — Registered `SmartConfigController`, added `Patient` entity to TypeORM imports
- `src/OAuth2/dto/oidc.dto.ts` — Added optional `launch` parameter to `OAuth2AuthorizeQueryDto`
- `src/OAuth2/pkce.service.ts` — Added `launch` field to `AuthCodeEntry` interface and `issueCode()` method

## Related Files

| File | Purpose |
|------|---------|
| `src/OAuth2/smart.controller.ts` | SMART discovery endpoint |
| `src/OAuth2/oauth2.controller.ts` | OAuth2 authorize and token endpoints |
| `src/OAuth2/pkce.service.ts` | PKCE authorization code management |
| `src/OAuth2/oidc.module.ts` | Module wiring |
| `src/OAuth2/dto/oidc.dto.ts` | DTOs with SMART launch support |
| `test/e2e/smart-on-fhir.e2e-spec.ts` | End-to-end tests |

Closes #680
