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
   - Database migrations must be down-migration safe. Never destroy non-recoverable schema or data without explicit guarded routines (`npm run check:migrations`).

---

## Getting Started

### Prerequisites

- **Node.js**: v20.x or later
- **npm** or **pnpm**
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
   npm install
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
   *Adjust local database credentials and Redis connection details in `.env` if needed.*

4. **Start Infrastructure Services**:
   ```bash
   docker-compose -f docker-compose.local.yml up -d
   ```

5. **Run Database Migrations & Seed Data**:
   ```bash
   npm run migration:run
   npm run seed
   ```

6. **Start the Development Server**:
   ```bash
   npm run start:dev
   ```
   The backend API will be available at `http://localhost:3000`.

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
npm run check:circular

# 2. Check for directory/file naming conventions
npm run check:no-spaces

# 3. Verify migration safety
npm run check:migrations

# 4. Check i18n translation completeness (if modifying messages)
npm run test:i18n
```

---

## Working with `@medchain/sdk`

The TypeScript SDK lives under `packages/sdk` and is built automatically from the backend OpenAPI/Swagger schema.

### Common SDK Scripts

- **Generate SDK from backend endpoints**:
  ```bash
  npm run generate:sdk
  ```
- **Build the SDK package**:
  ```bash
  npm run build:sdk
  ```
- **Run SDK tests**:
  ```bash
  npm run test:sdk
  ```
- **Check for OpenAPI vs SDK drift**:
  ```bash
  npm run check:sdk-drift
  ```
- **Bump SDK Version**:
  ```bash
  npm run version:sdk 1.1.0
  ```

> **Note**: Changes to API controller endpoints or DTOs should always be checked for SDK drift (`npm run check:sdk-drift`) before merging.

---

## Testing Guidelines

We enforce high test coverage for clinical workflows and payment integrity.

### Running Test Suites

- **Unit Tests**:
  ```bash
  npm run test:unit
  ```
- **End-to-End (E2E) Tests**:
  ```bash
  npm run test:e2e
  ```
- **Compliance & Security Tests**:
  ```bash
  npm run test:compliance
  ```
- **Performance & Load Tests (k6)**:
  ```bash
  npm run load-test:smoke
  ```
- **All Tests**:
  ```bash
  npm run test:all
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
4. **Fill out PR Template**: Include clear summary details, linked issues (e.g., `Closes #123`), and verification steps.
5. **Address Code Review**: Resolve feedback from maintainers. Once approved and CI passes, your branch will be squash-merged into `main`.

Thank you for helping build a secure, decentralized healthcare ecosystem! 🚀
