# Healthcare Tenant Provisioning and Onboarding System

A complete NestJS-based tenant provisioning system for healthcare organizations, featuring automated schema creation, contract deployment, and multi-tenant database management.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Provisioning Pipeline](#provisioning-pipeline)
- [Testing](#testing)
- [Database Schema](#database-schema)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

## Overview

This system automates the complete tenant onboarding process for a healthcare platform, including:

- Tenant record creation
- Dedicated PostgreSQL schema provisioning
- Database migrations and initialization
- Default role and admin user creation
- Soroban smart contract deployment on Stellar network
- Welcome email notifications
- Comprehensive logging and error tracking
- Soft-delete deprovisioning

## Features

### Full Provisioning Pipeline

1. **Tenant Record Creation**: Creates tenant in public schema with status tracking
2. **Schema Creation**: Generates dedicated PostgreSQL schema for each tenant
3. **Database Migrations**: Automatically runs schema migrations for roles, users, and audit logs
4. **Data Seeding**: Creates default roles and admin user accounts
5. **Contract Deployment**: Deploys Stellar Soroban contracts for blockchain integration
6. **Configuration Storage**: Stores contract addresses on tenant record
7. **Email Notifications**: Sends welcome confirmation emails

### Job Queue Management

- **BullMQ Integration**: Asynchronous job processing with Redis
- **Job Persistence**: Maintains job history for audit trails
- **Progress Tracking**: Real-time provisioning status updates
- **Error Handling**: Automatic rollback on failures

### Multi-Tenancy

- Independent database schemas per tenant
- Isolated data storage
- Tenant-specific configurations
- Audit logging for compliance

### API Endpoints

```
POST   /admin/tenants                           - Queue provisioning job
GET    /admin/tenants                           - List all tenants
GET    /admin/tenants/:id                       - Get tenant details
GET    /admin/tenants/:id/provisioning-status   - Get provisioning status
DELETE /admin/tenants/:id                       - Archive tenant (soft delete)
```

## Architecture

### Module Structure

```
src/
├── database/              # Database configuration
│   └── database.config.ts
├── tenants/              # Tenant-specific modules
│   ├── controllers/      # HTTP endpoints
│   │   └── tenants.controller.ts
│   ├── services/         # Business logic
│   │   ├── provisioning.service.ts
│   │   ├── database.service.ts
│   │   ├── soroban.service.ts
│   │   └── email.service.ts
│   ├── entities/         # TypeORM entities
│   │   ├── tenant.entity.ts
│   │   └── provisioning-log.entity.ts
│   ├── dto/             # Data transfer objects
│   │   └── tenant.dto.ts
│   ├── processors/       # BullMQ job processors
│   │   └── provisioning.processor.ts
│   └── tenants.module.ts # Module definition
├── app.module.ts         # Root module
└── main.ts              # Application entry point
```

### Service Components

#### ProvisioningService

Main orchestrator for the provisioning pipeline. Handles all provisioning steps in sequence with logging and error recovery.

#### DatabaseService

Manages PostgreSQL operations including schema creation, migrations, seeding, and user management.

#### SorobanService

Integrates with Stellar Soroban network for smart contract deployment and verification.

#### EmailService

Handles email communications including welcome messages and error notifications.

#### ProvisioningProcessor

BullMQ job processor that handles asynchronous provisioning jobs.

## Prerequisites

- Node.js 18+ or Docker
- PostgreSQL 12+
- Redis 6+
- npm or yarn

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=tenant_provisioning

# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Email Configuration
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=noreply@healthcare.local
MAIL_PASSWORD=your-app-password
MAIL_FROM=Healthcare Platform <noreply@healthcare.local>

# Stellar/Soroban
SOROBAN_NETWORK=testnet
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
SOROBAN_CONTRACT_DEPLOYER_SECRET=your-secret-key

# Application
NODE_ENV=development
APP_PORT=3000
APP_URL=http://localhost:3000
```

## Installation

### Local Development Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start PostgreSQL and Redis
# Using Docker Compose (if available)
docker-compose up -d

# Build the project
npm run build

# Run migrations
npm run migration:run
```

### Docker Setup (Optional)

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

## Configuration

### Database Configuration

The application uses TypeORM with PostgreSQL. Configuration is in `src/database/database.config.ts`:

```typescript
export const dataSourceOptions: DataSourceOptions = {
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "tenant_provisioning",
  // ...
};
```

### BullMQ Configuration

Job queue settings in `src/tenants/tenants.module.ts`:

```typescript
BullModule.registerQueue({
  name: "provisioning",
  settings: {
    maxStalledCount: 2,
    stalledInterval: 5000,
  },
});
```

## Running the Application

### Development

```bash
# Start with watch mode
npm run start:dev

# Application runs on http://localhost:3000
```

### Production

```bash
# Build
npm run build

# Start
npm run start:prod
```

### With Docker

```bash
# Build image
docker build -t tenant-provisioning .

# Run container
docker run -p 3000:3000 --env-file .env tenant-provisioning
```

## API Endpoints

### 1. Queue Provisioning Job

**Endpoint**: `POST /admin/tenants`

**Request**:

```json
{
  "name": "Acme Healthcare Corp",
  "adminEmail": "admin@acmehc.local",
  "adminFirstName": "John",
  "adminLastName": "Smith"
}
```

**Response** (202 Accepted):

```json
{
  "jobId": "5",
  "status": "queued",
  "message": "Tenant provisioning for Acme Healthcare Corp has been queued"
}
```

### 2. Get Provisioning Status

**Endpoint**: `GET /admin/tenants/:id/provisioning-status`

**Response** (200 OK):

```json
{
  "tenantId": "uuid",
  "tenantName": "Acme Healthcare Corp",
  "overallStatus": "ACTIVE",
  "logs": [
    {
      "id": "uuid",
      "step": "CREATE_TENANT_RECORD",
      "status": "COMPLETED",
      "createdAt": "2026-02-21T10:30:00Z"
    }
    // ... more steps
  ],
  "createdAt": "2026-02-21T10:30:00Z",
  "updatedAt": "2026-02-21T10:35:00Z",
  "completedAt": "2026-02-21T10:35:00Z"
}
```

### 3. List All Tenants

**Endpoint**: `GET /admin/tenants`

**Response** (200 OK):

```json
{
  "total": 5,
  "tenants": [
    {
      "id": "uuid",
      "name": "Acme Healthcare Corp",
      "status": "ACTIVE",
      "adminEmail": "admin@acmehc.local",
      "createdAt": "2026-02-21T10:30:00Z"
    }
  ]
}
```

### 4. Get Tenant Details

**Endpoint**: `GET /admin/tenants/:id`

**Response** (200 OK):

```json
{
  "id": "uuid",
  "name": "Acme Healthcare Corp",
  "schemaName": "acme_healthcare_corp_1708599000000",
  "status": "ACTIVE",
  "adminEmail": "admin@acmehc.local",
  "sorobanContractId": "contract_abc123",
  "createdAt": "2026-02-21T10:30:00Z",
  "updatedAt": "2026-02-21T10:35:00Z"
}
```

### 5. Archive Tenant

**Endpoint**: `DELETE /admin/tenants/:id`

**Response** (200 OK):

```json
{
  "status": "archived",
  "message": "Tenant uuid has been archived"
}
```

## Provisioning Pipeline

### Step-by-Step Process

The provisioning pipeline executes the following steps in order with full logging:

#### 1. Create Tenant Record

- Creates tenant entry in public schema
- Sets status to PROVISIONING
- Unique schema name generated

#### 2. Create PostgreSQL Schema

- Creates dedicated tenant schema
- Schema name pattern: `{tenant_name_slug}_{timestamp}`
- Validates schema name for SQL injection prevention

#### 3. Run Migrations

- Creates `roles` table
- Creates `users` table
- Creates `audit_logs` table
- All tables use UUID primary keys

#### 4. Seed Roles and Create Admin User

- Creates default roles: admin, user, viewer
- Creates admin user account
- Admin password initially set to temporary value (should be changed on first login)

#### 5. Deploy Soroban Contract

- Deploys tenant-specific smart contract
- Returns contract ID
- Verifies successful deployment

#### 6. Store Contract Address

- Updates tenant record with contract ID
- Persists in database

#### 7. Send Welcome Email

- Sends welcome message to admin
- Includes tenant URL and login instructions
- Provides contact for support

### Error Handling and Rollback

If any step fails:

1. Error is logged with timestamp and details
2. Tenant status is set to FAILED
3. Error message is stored on tenant record
4. PostgreSQL schema is dropped (rollback)
5. Error email is sent to admin
6. Job is marked as failed with error details

### Status Tracking

Each step creates a ProvisioningLog record:

```typescript
export enum ProvisioningStep {
  CREATE_TENANT_RECORD = "CREATE_TENANT_RECORD",
  CREATE_SCHEMA = "CREATE_SCHEMA",
  RUN_MIGRATIONS = "RUN_MIGRATIONS",
  SEED_ROLES_AND_USER = "SEED_ROLES_AND_USER",
  DEPLOY_SOROBAN_CONTRACT = "DEPLOY_SOROBAN_CONTRACT",
  STORE_CONTRACT_ADDRESS = "STORE_CONTRACT_ADDRESS",
  SEND_WELCOME_EMAIL = "SEND_WELCOME_EMAIL",
}

export enum ProvisioningStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  ROLLED_BACK = "ROLLED_BACK",
}
```

## Testing

### Unit Tests

Run unit tests for services:

```bash
npm run test
```

### Integration Tests

Run full end-to-end provisioning tests:

```bash
npm run test:e2e
```

### Coverage

Generate test coverage reports:

```bash
npm run test:cov
```

### Test Scenarios Covered

1. ✅ Successful full tenant provisioning
2. ✅ Invalid input validation (email, name length)
3. ✅ Missing required fields
4. ✅ Provisioning failure and rollback
5. ✅ SQL injection prevention (schema name sanitization)
6. ✅ Tenant listing and retrieval
7. ✅ Provisioning status tracking
8. ✅ Soft delete/archival
9. ✅ Error email notifications
10. ✅ Non-existent tenant handling

## Database Schema

### Public Schema

**Tenants Table** (`public.tenants`):

```sql
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  schema_name VARCHAR(255) UNIQUE NOT NULL,
  status ENUM('PENDING', 'PROVISIONING', 'ACTIVE', 'FAILED', 'ARCHIVED'),
  admin_email VARCHAR(255),
  admin_first_name VARCHAR(255),
  admin_last_name VARCHAR(255),
  soroban_contract_id VARCHAR(255),
  provisioning_error VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP
);

CREATE TABLE public.provisioning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  step ENUM(...),
  status ENUM(...),
  result TEXT,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tenant-Specific Schemas

Each tenant schema includes:

**Roles Table** (`{tenant_schema}.roles`):

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Users Table** (`{tenant_schema}.users`):

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  role_id UUID REFERENCES roles(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Audit Logs Table** (`{tenant_schema}.audit_logs`):

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(255),
  entity_type VARCHAR(255),
  entity_id VARCHAR(255),
  changes JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Security Considerations

### Input Validation

- Email validation using class-validator
- Tenant name length validation (minimum 3 characters)
- Schema name sanitization to prevent SQL injection
- All inputs are validated against defined DTO schemas

### Database Security

- Prepared statements (TypeORM parameterized queries)
- Schema names validated with regex: `^[a-z_][a-z0-9_]*$`
- Foreign key constraints for referential integrity
- Soft delete (archival) instead of hard delete for compliance

### Authentication & Authorization

- Admin-only endpoints (should be secured with JWT in production)
- API key validation recommended for production deployment
- All operations are logged for audit trails

### Error Handling

- Sensitive error details logged internally only
- Generic error messages returned to clients
- Stack traces never exposed in API responses
- Provisioning errors sanitized before storage (500 char limit)

### Email Security

- Email credentials stored in environment variables
- TLS/SSL for SMTP connections
- Email addresses validated before sending

### Soroban Integration

- Contract deployer secret stored in environment variables
- Never logged or exposed in responses
- Network validation (testnet vs. mainnet)

### Data Privacy

- Separate schema per tenant ensures data isolation
- Password hashing (SHA-256, but recommend bcrypt in production)
- Audit logs track all data modifications
- GDPR compliance through soft deletes and archival

## Troubleshooting

### Common Issues

**Issue**: "ECONNREFUSED - Redis connection failed"

- **Solution**: Ensure Redis is running on localhost:6379
- Try: `redis-cli ping` to verify

**Issue**: "connect ECONNREFUSED - PostgreSQL connection failed"

- **Solution**: Ensure PostgreSQL is running
- Check DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD in .env

**Issue**: Job stays in "queued" state indefinitely

- **Solution**: Check Redis connection and BullMQ logs
- Verify no errors in provisioning job processing logs

**Issue**: "Invalid schema name" error

- **Solution**: This is by design - tenant names with special characters are rejected
- Use alphanumeric names with spaces, hyphens only

**Issue**: Email not sent

- **Solution**: Check MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD
- Try: `telnet {MAIL_HOST} {MAIL_PORT}` to test SMTP connection
- Enable "Less secure apps" for Gmail accounts (if using Gmail)

**Issue**: Soroban contract deployment fails

- **Solution**: Verify SOROBAN_RPC_URL is correct for network
- Check SOROBAN_CONTRACT_DEPLOYER_SECRET is valid
- Ensure contract account has sufficient XLM balance

### Debugging

Enable debug logging:

```bash
NODE_ENV=development npm run start:dev
```

View provisioning logs:

```sql
SELECT * FROM public.provisioning_logs
WHERE tenant_id = 'your-tenant-id'
ORDER BY created_at DESC;
```

Check job queue status:

```bash
redis-cli
> KEYS "bull:provisioning:*"
> HGETALL bull:provisioning:data
```

## Production Deployment

### Recommendations

1. **Use strong passwords** for PostgreSQL and Redis
2. **Enable SSL/TLS** for database and SMTP connections
3. **Use environment-specific .env files** - never commit .env to git
4. **Implement rate limiting** on provisioning endpoints
5. **Set up monitoring** for job queue health
6. **Configure automated backups** for PostgreSQL
7. **Use bcrypt** instead of SHA-256 for password hashing
8. **Implement JWT authentication** for API endpoints
9. **Set up CloudWatch or similar** for logs
10. **Use secrets manager** (AWS Secrets Manager, Vault, etc.)

### Scaling Considerations

- Job queue can handle multiple workers
- Database connection pooling recommended
- Consider read replicas for reporting
- Cache frequently accessed tenant data
- Use CDN for static assets

## License

UNLICENSED (Change as needed)

## Support

For issues or questions, contact support@healthcare.local
