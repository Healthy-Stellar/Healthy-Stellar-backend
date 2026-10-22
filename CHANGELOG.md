# Changelog

All notable changes to this project (both the NestJS backend core and `@medchain/sdk`) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

---

## [1.1.0] - 2026-10-01

Backfilled from all merged PRs since `1.0.0` (2026-07-27). Integrators upgrading from `1.0.0` should review the **Security** section first — several auth-guard and IDOR fixes are breaking for clients that relied on the previous (incorrect) behaviour.

### Added
- Created `CONTRIBUTING.md` contributor onboarding guide and repository `CHANGELOG.md` ([#789](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/issues/789)).
- **Webhooks integrator guide** (`docs/webhooks.md`): outbound delivery headers, HMAC signature verification with Node/Python snippets, secret rotation semantics, retries and failure alerts, manual replay, the event catalog, and the inbound provider signing scheme; linked from the README and covered by `src/webhooks/webhook-signature.docs.spec.ts` ([#1084](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/issues/1084)).
- **Appointment waitlist auto-fill**: cancelled or expired appointments now automatically offer the freed slot to the next eligible waitlisted patient, with configurable offer expiry and notification fan-out ([#1092](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1092)).
- **Credential tracking**: practitioner licence and certification records are now tracked with expiry dates, verification status, and scheduled reminders ahead of renewal ([#1103](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1103)).
- **Bulk export**: asynchronous bulk export of patient records and audit trails (FHIR `$export`-style job submission, polling, and signed download URLs) ([#1117](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1117)).
- **`@medchain/sdk` v1.1.0**: regenerated client covering waitlist, credential, and bulk-export endpoints; published via `publish-sdk.yml` ([#1129](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1129)).
- Additional features merged since `1.0.0` (see the linked PRs for details): [#1013](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1013), [#1021](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1021), [#1034](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1034), [#1047](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1047), [#1058](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1058), [#1069](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1069), [#1078](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1078), [#1089](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1089), [#1098](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1098), [#1109](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1109), [#1121](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1121), [#1133](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1133).

### Changed
- **Auth guard composition**: `JwtAuthGuard` / `RolesGuard` are now applied globally with explicit `@Public()` opt-outs; endpoints that previously relied on implicit public access must be annotated ([#1011](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1011)).
- **Tenant scoping**: all repository queries for tenant-owned resources now require an explicit tenant context; unscoped access throws instead of silently returning cross-tenant rows ([#1024](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1024)).
- **Error envelope**: validation and authorization failures now return the standard `{ statusCode, error, message, requestId }` envelope ([#1039](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1039)).
- **Dependency upgrades**: bumped NestJS, Prisma, and GraphQL toolchain to current patch/minor releases; removed deprecated transitive packages ([#1051](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1051)).
- **CI**: split lint/test/build into parallel jobs and added a required CHANGELOG check for PRs ([#1136](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1136)).

### Fixed
- **Compile breaks on `main`**: repaired broken imports, missing DI providers, and type errors introduced by concurrent merges ([#1019](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1019), [#1042](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1042), [#1063](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1063), [#1081](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1081), [#1112](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1112)).
- **IDOR on patient-scoped resources**: documents, appointments, and audit records are now resolved with an ownership check against the authenticated principal ([#1028](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1028), [#1055](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1055)).
- **Webhook delivery**: fixed duplicate deliveries on retry and corrected HMAC signature computation for large payloads ([#1071](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1071)).
- **Bulk export job leaks**: jobs are now cancelled and their temporary artifacts purged when a tenant is offboarded ([#1124](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1124)).
- Additional fixes merged since `1.0.0`: [#1031](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1031), [#1044](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1044), [#1066](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1066), [#1075](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1075), [#1086](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1086), [#1095](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1095), [#1106](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1106), [#1114](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1114), [#1131](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1131).

### Security
- **Missing auth guards**: added `JwtAuthGuard`/`RolesGuard` to controllers that were unintentionally unauthenticated, including several admin and reporting endpoints ([#1011](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1011), [#1015](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1015), [#1037](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1037)).
- **IDOR fixes**: enforced ownership/tenant checks on document download, appointment retrieval, patient profile, and audit-log endpoints ([#1028](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1028), [#1055](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1055), [#1073](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1073), [#1090](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1090)).
- **Privilege escalation**: role assignment endpoints now reject self-elevation and require an admin-scoped token ([#1049](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1049)).
- **Token handling**: refresh-token rotation now revokes the entire token family on reuse detection; access tokens are rejected after password reset ([#1061](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1061)).
- **Input validation**: tightened DTO validation and enabled global `ValidationPipe` whitelisting to block mass-assignment on user and tenant updates ([#1084](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1084), [#1100](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1100)).
- **Dependency advisories**: patched vulnerable transitive dependencies flagged by `npm audit` / Dependabot ([#1119](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1119), [#1134](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1134)).
- **Compile-break regressions with security impact**: restored guards and validation that had been dropped during merge conflicts ([#1042](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1042), [#1112](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/1112)).

---

## [1.0.0] - 2026-07-27

### Added
- **GDPR Erasure Request Pipeline**: Full automated data erasure workflow complying with GDPR right-to-be-forgotten requests ([#845](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/845)).
- **MFA Enforcement for Clinical Roles**: Mandatory Multi-Factor Authentication requirement enforced for clinical and administrative user roles ([#843](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/843)).
- **Database Seeding Workflow**: Automated database seeding scripts and documentation for rapid local environment setup ([#840](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/840)).
- **PHI Audit Logging**: Dedicated HIPAA-compliant Protected Health Information (PHI) access and mutation audit pipeline ([#779](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/779)).
- **Appointment Booking Conflict Prevention**: Race-free booking service using Postgres advisory locks (`pg_try_advisory_xact_lock`), configurable buffer windows (`APPOINTMENT_BUFFER_MINUTES`), and structured 409 responses ([#680](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/issues/680)).
- **SMART on FHIR Authorization Server**: OAuth2 EHR launch sequence support, `/.well-known/smart-configuration` endpoint, PKCE (S256), and `launch/patient` context resolution ([#680](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/680)).
- **Per-Tenant IP Allowlist**: Tenant configuration guard (`TenantIpAllowlistGuard`) supporting CIDR subnet rules and proxy headers ([#681](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/issues/681)).
- **GraphQL Automatic Persisted Queries (APQ)**: Redis-backed query hashing plugin enforcing approved GraphQL operations in production ([#676](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/issues/676)).
- **Digital Signature Verification**: Cryptographic PKCS#7 / CAdES signature extraction and validation for medical PDF attachments stored on IPFS ([#677](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/issues/677)).
- **TypeScript Client SDK (`@medchain/sdk` v1.0.0)**: Auto-generated client package for TypeScript/JavaScript consumers, with automated publication pipelines (`publish-sdk.yml`).

### Fixed
- **Stellar Payment Concurrency**: Closed payment processing race conditions and implemented dead-letter queue retry mechanism ([#844](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/844)).
- **OpenAPI Export Path**: Fixed broken import path in `docs:generate` script preventing OpenAPI specification export ([#841](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/pull/841)).

---

## Guidelines for Updating this File

When submitting a Pull Request:

1. Add your changes under the **`[Unreleased]`** header.
2. Group changes under the standard subheadings:
   - `Added` for new features.
   - `Changed` for changes in existing functionality.
   - `Deprecated` for soon-to-be removed features.
   - `Removed` for now removed features.
   - `Fixed` for any bug fixes.
   - `Security` in case of vulnerabilities.
3. Link the PR or Issue number at the end of each entry (e.g. `([#123](https://github.com/...))`).
4. Tick the **Changelog** checkbox in the PR template — CI (`.github/workflows/changelog-check.yml`) fails PRs that modify `src/`, `docs/`, or `prisma/` without touching `CHANGELOG.md` under `[Unreleased]`.
