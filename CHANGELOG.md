# Changelog

All notable changes to this project (both the NestJS backend core and `@medchain/sdk`) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Created `CONTRIBUTING.md` contributor onboarding guide and repository `CHANGELOG.md` ([#789](https://github.com/Healthy-Stellar/Healthy-Stellar-backend/issues/789)).

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
