# Contributing to Healthy Stellar Backend & MedChain SDK

Thank you for your interest in contributing to the **Healthy Stellar Backend**! This repository hosts the core NestJS backend services for our decentralized healthcare platform and the official client SDK (`@medchain/sdk`).

We welcome contributions from developers of all skill levels. To maintain code quality, security, and HIPAA compliance across our multi-contributor project, please follow the guidelines outlined below.

---

## Table of Contents

- [Code of Conduct & HIPAA Guidelines](#code-of-conduct--hipaa-guidelines)
- [Getting Started](#getting-started)
- [Project Architecture & Directory Structure](#project-architecture--directory-structure)
- [Development Workflow & Branching Strategy](#development-workflow--branching-strategy)
- [Commit Message Format](#commit-message-format)
- [Code Quality & Safety Checks](#code-quality--safety-checks)
- [New Controller Security Checklist](#new-controller-security-checklist)
- [Working with `@medchain/sdk`](#working-with-medchainsdk)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)

---

## Code of Conduct & HIPAA Guidelines

As a healthcare application handling sensitive Medical and Patient data:

1. **Zero Protected Health Information (PHI) Exposure**:
   - Never log patient names, SSNs, medical histories, or contact details in plain text.
   - Ensure error responses (e.g., 409 conflict, 400 validation) strip PHI details and emit only sanitized identifiers or metadata.
   - Audit logging (`src/audit-log`) must encrypt or redact sensitive fields.

2. **Security & Cryptography**:
   - All medical document attachments must maintain digital signature verification (`src/records/services/digital-signature.service.ts`).
   - Stellar blockchain operations and private key handling must use KMS / secure vault mechanisms (`src/stellar`).

3. **Data Integrity**:
  - Database migrations must be down-migration safe. Never destroy non-recoverable schema or data without explicit guarded routines (`pnpm run check:migrations`).

---

## Getting Started

### Prerequisites

- **Node.js**: v20.x or later
- **pnpm** (version pinned in `package.json`)
- **Docker & Docker Compose**: For local PostgreSQL and Redis services
- **Git**

### Local Environment Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Healthy-Stellar/Healthy-Stellar-backend.git
   cd Healthy-Stellar-backend
   ```

2. **Install Dependencies**:
   ```bash
  corepack enable
  pnpm install --frozen-lockfile
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
  *Adjust local database credentials, Redis connection details, and the required secret values in `.env`.*

4. **Start Infrastructure Services**:
   ```bash
  docker compose -f docker-compose.local.yml up -d
   ```

5. **Run Database Migrations & Seed Data**:
   ```bash
  pnpm run migration:run
  pnpm run seed
   ```

6. **Start the Development Server**:
   ```bash
  pnpm run start:dev
   ```
   The backend API will be available at `http://localhost:3000`.

7. **Check environment documentation**:
  ```bash
  pnpm run check:env
  ```
  This checks statically referenced environment keys against `.env.example`.

---

## Project Architecture & Directory Structure

```
Healthy-Stellar-backend/
├── .github/
│   └── workflows/          # GitHub Actions workflows (CI, migration safety, SDK publishing)
├── docs/                   # System documentation & OpenAPI specs
├── load-tests/             # k6 performance and load testing scenarios
├── packages/
│   └── sdk/                # @medchain/sdk TypeScript client package
├── scripts/                # Utility scripts (SDK generation, migration checks, benchmarks)
├── src/                    # NestJS application source code
│   ├── appointments/       # Scheduling, booking conflict prevention & advisory locking
│   ├── audit-log/          # PHI audit logging pipeline
│   ├── auth/               # Authentication, MFA enforcement & JWT handling
│   ├── config/             # Environment & service configurations
│   ├── database/           # TypeORM entities, migrations & seeders
│   ├── graphql/            # GraphQL resolvers, schema & APQ (Persisted Queries)
│   ├── OAuth2/             # SMART on FHIR authorization server & PKCE endpoints
│   ├── records/            # EHR records, IPFS attachment storage & digital signatures
│   ├── stellar/            # Stellar Horizon & Soroban blockchain integration
│   └── tenant-config/      # Multi-tenant IP allowlists & tenant settings
├── test/                   # E2E, compliance, and integration tests
├── CONTRIBUTING.md         # Contributor onboarding document (this file)
└── CHANGELOG.md            # Release version history
```

---

## Development Workflow & Branching Strategy

We use a feature-branch workflow. All work should be developed on a topic branch created from `main`.

### Branch Naming Convention

Format: `<type>/<short-description>-<issue-number>`

- **Features**: `feat/mfa-enforcement-753`
- **Fixes**: `fix/payment-concurrency-844`
- **Documentation**: `docs/789-contributing-changelog`
- **Refactoring**: `refactor/appointment-locking-680`

### Creating a Branch

```bash
git checkout main
git pull origin main
git checkout -b feat/my-new-feature-123
```

---

## Commit Message Format

We adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat(scope): add patient export endpoint (#123)`
- `fix(billing): prevent race condition in payment retry (#844)`
- `docs(api): update OpenAPI spec for SMART on FHIR (#680)`
- `test(records): add unit test for digital signature verification (#677)`
- `refactor(auth): enforce MFA requirement for clinical roles (#843)`

---

## Code Quality & Safety Checks

Before submitting a Pull Request, verify that your changes pass all local safety checks:

```bash
# 1. Check for circular dependencies
pnpm run check:circular

# 2. Check for directory/file naming conventions
pnpm run check:no-spaces

# 3. Verify migration safety
pnpm run check:migrations

# 4. Check i18n translation completeness (if modifying messages)
pnpm run test:i18n
```

---

## New Controller Security Checklist

There is **no global authentication guard** in this application. Every controller is responsible for opting in to authentication and authorization. Before opening a PR that adds or modifies a controller, confirm each item below. For the full auth model (token issuance/refresh, principal shape, guard catalogue, roles, `@Public()`, API keys, MFA, SMART scopes), see [`docs/auth.md`](docs/auth.md).

- [ ] **Opt in to guards**: Decorate the controller (or each handler) with `@UseGuards(JwtAuthGuard, RolesGuard)`. `RolesGuard` alone does **not** authenticate the request, and `AdminGuard`, `PatientPrivacyGuard` and `MedicalRbacGuard` do not authenticate on their own either — always pair them with `JwtAuthGuard`.
- [ ] **Declare explicit roles**: Add `@Roles(...)` (or `@HipaaRoles(...)` / `@RequireAdmin()`) to every guarded handler. `RolesGuard` with no `@Roles` metadata allows **any authenticated user** through. Use only valid `UserRole` enum values.
- [ ] **Use the correct principal fields**: The JWT principal is `{ userId, email, role, mfaEnabled, sessionId, organizationId }`. Read `req.user.userId` — there is no `id`, `sub` or `tenantId` on the principal.
- [ ] **Enforce ownership**: For patient-scoped resources, verify the authenticated user owns (or is authorized for) the resource — do not rely on the route parameter alone. Return `403`/`404` rather than leaking existence.
- [ ] **Mark public routes**: Any route that must be reachable without a token (login, refresh, health checks, webhooks) must be explicitly decorated with `@Public()`. Never leave a route unguarded by accident.
- [ ] **Document roles in Swagger**: Annotate handlers with `@ApiBearerAuth()` and describe the required roles in the operation summary/description so the generated OpenAPI spec and SDK reflect the access requirements.
- [ ] **Add e2e IDOR tests**: Include `.e2e-spec.ts` coverage proving that a user without the required role or ownership is rejected (401/403), and that cross-tenant/cross-patient access is blocked.

---

## Working with `@medchain/sdk`

The TypeScript SDK lives under `packages/sdk` and is built automatically from the backend OpenAPI/Swagger schema.

### Common SDK Scripts

- **Generate SDK from backend endpoints**:
  ```bash
  pnpm run generate:sdk
  ```
- **Build the SDK package**:
  ```bash
  pnpm run build:sdk
  ```
- **Run SDK tests**:
  ```bash
  pnpm run test:sdk
  ```
- **Check for OpenAPI vs SDK drift**:
  ```bash
  pnpm run check:sdk-drift
  ```
- **Bump SDK Version**:
  ```bash
  pnpm run version:sdk 1.1.0
  ```

> **Note**: Changes to API controller endpoints or DTOs should always be checked for SDK drift (`pnpm run check:sdk-drift`) before merging.

---

## Testing Guidelines

We enforce high test coverage for clinical workflows and payment integrity.

### Running Test Suites

- **Unit Tests**:
  ```bash
  pnpm run test:unit
  ```
- **End-to-End (E2E) Tests**:
  ```bash
  pnpm run test:e2e
  ```
- **Compliance & Security Tests**:
  ```bash
  pnpm run test:compliance
  ```
- **Performance & Load Tests (k6)**:
  ```bash
  pnpm run load-test:smoke
  ```
- **All Tests**:
  ```bash
  pnpm run test:all
  ```

When adding new service logic or API endpoints, include accompanying `.spec.ts` (unit) and `.e2e-spec.ts` (E2E) files.

---

## Pull Request Process

1. **Rebase on Main**: Ensure your branch is up-to-date with `main`:
   ```bash
   git fetch origin main
   git rebase origin/main
   ```
2. **Update CHANGELOG.md**: Document your additions, fixes, or breaking changes in the `[Unreleased]` section of `CHANGELOG.md`.
3. **Submit PR**: Open a Pull Request targeting `main`.
4. **Fill out PR Template**: Include clear summary details, linked issues (e.g., `Closes #123`), and verification steps. If your PR touches a controller, confirm the [New Controller Security Checklist](#new-controller-security-checklist) in the PR template.
5. **Address Code Review**: Resolve feedback from maintainers. Once approved and CI passes, your branch will be squash-merged into `main`.

Thank you for helping build a secure, decentralized healthcare ecosystem! 🚀
