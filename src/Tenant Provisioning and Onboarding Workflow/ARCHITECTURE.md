# Architecture Documentation

## System Overview

The Healthcare Tenant Provisioning System is a NestJS-based microservice that automates the complete onboarding process for new healthcare organizations. It manages multi-tenant database provisioning, smart contract deployment, and comprehensive audit logging.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (HTTP)                          │
│                   TenantsController                          │
├─────────────────────────────────────────────────────────────┤
│                    Business Logic Layer                      │
│  ProvisioningService ← Main Orchestrator                     │
├─────────────────────────────────────────────────────────────┤
│                    Job Queue (BullMQ)                        │
│             ProvisioningProcessor (Async Jobs)              │
├─────────────────────────────────────────────────────────────┤
│                   Service Layer                             │
│ DatabaseService | SorobanService | EmailService            │
├─────────────────────────────────────────────────────────────┤
│                 Data Persistence Layer                       │
│  PostgreSQL (Public + Tenant Schemas) | Redis (Queue)      │
└─────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. API Layer (TenantsController)

**Responsibility**: Handle HTTP requests and responses

**Endpoints**:

- `POST /admin/tenants` - Queue provisioning job
- `GET /admin/tenants` - List all tenants
- `GET /admin/tenants/:id` - Get tenant details
- `GET /admin/tenants/:id/provisioning-status` - Get provisioning status
- `DELETE /admin/tenants/:id` - Archive tenant

**Key Features**:

- Input validation via DTOs
- Error handling and response formatting
- Job queueing with BullMQ
- Status tracking and reporting

### 2. Job Queue (BullMQ + Redis)

**Responsibility**: Asynchronous job processing

**Flow**:

```
Client Request
    ↓
Controller receives request
    ↓
Add job to queue
    ↓
Return 202 Accepted immediately
    ↓
Processor picks up job from Redis
    ↓
Execute provisioning steps
    ↓
Store results in database
```

**Benefits**:

- Non-blocking API responses
- Job persistence and retry capability
- Progress tracking
- Scalable (multiple workers possible)
- Audit trail of all jobs

### 3. Provisioning Service (Orchestrator)

**Responsibility**: Coordinate all provisioning steps

**Process**:

```
START
  ↓
Step 1: Create Tenant Record
  └─→ Database: Insert into public.tenants
  ↓
Step 2: Create PostgreSQL Schema
  └─→ Database: CREATE SCHEMA {tenant_schema}
  ↓
Step 3: Run Migrations
  └─→ Database: Create tables (roles, users, audit_logs)
  ↓
Step 4: Seed Roles and Admin User
  └─→ Database: Insert default roles and admin user
  ↓
Step 5: Deploy Soroban Contract
  └─→ Stellar: Deploy smart contract
  ↓
Step 6: Store Contract Address
  └─→ Database: Update tenant record with contract ID
  ↓
Step 7: Send Welcome Email
  └─→ Email: Send welcome notification
  ↓
END (Success)

OR ON ERROR:
  ↓
Log error step
  └─→ Database: Insert failed log entry
  ↓
Update tenant status to FAILED
  └─→ Database: Update status
  ↓
Rollback: Drop schema
  └─→ Database: DROP SCHEMA {tenant_schema}
  ↓
Send error email
  └─→ Email: Send error notification
  ↓
END (Failure)
```

### 4. Database Service

**Responsibility**: PostgreSQL operations

**Functions**:

- `createTenantSchema()` - Create dedicated schema
- `dropTenantSchema()` - Drop schema (rollback)
- `runTenantMigrations()` - Create tables and indexes
- `seedTenantData()` - Insert default data
- `createAdminUser()` - Create admin account

**SQL Injection Prevention**:

- Schema names validated with regex
- Parameterized queries using TypeORM
- Input sanitization

### 5. Soroban Service

**Responsibility**: Stellar blockchain integration

**Functions**:

- `deployTenantContract()` - Deploy contract on Soroban
- `verifyContractDeployment()` - Verify contract status

**Configuration**:

- Network: Testnet or Public
- RPC URL: Soroban RPC endpoint
- Deployer Key: Service account secret key

### 6. Email Service

**Responsibility**: Email communications

**Functions**:

- `sendWelcomeEmail()` - Welcome notification
- `sendProvisioningErrorEmail()` - Error notification

**Configuration**:

- SMTP Host: Email service provider
- Authentication: Username/password
- TLS/SSL: Secure connection

### 7. Entities

#### Tenant (Public Schema)

```typescript
{
  id: UUID,
  name: string,
  schemaName: string,
  status: TenantStatus,
  adminEmail: string,
  adminFirstName: string,
  adminLastName: string,
  sorobanContractId?: string,
  provisioningError?: string,
  createdAt: Date,
  updatedAt: Date,
  archivedAt?: Date,
  provisioningLogs: ProvisioningLog[]
}
```

#### ProvisioningLog (Public Schema)

```typescript
{
  id: UUID,
  tenantId: UUID,
  step: ProvisioningStep,
  status: ProvisioningStatus,
  result?: string,
  error?: string,
  durationMs?: number,
  createdAt: Date
}
```

#### Tenant-Specific Tables (Tenant Schema)

**Roles Table**:

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP
);
```

**Users Table**:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  password_hash VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  is_active BOOLEAN,
  role_id UUID FK,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Audit Logs Table**:

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID FK,
  action VARCHAR(255),
  entity_type VARCHAR(255),
  entity_id VARCHAR(255),
  changes JSONB,
  created_at TIMESTAMP
);
```

## Data Flow

### Provisioning Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Client sends POST /admin/tenants with org details     │
└────────────────┬─────────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────────────┐
│ 2. Controller validates input (DTO validation)           │
└────────────────┬─────────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────────────┐
│ 3. Controller queues provisioning job in BullMQ          │
│    (Returns 202 Accepted with jobId)                     │
└────────────────┬─────────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────────────┐
│ 4. Processor picks up job from Redis queue               │
│    (When worker is available)                            │
└────────────────┬─────────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────────────┐
│ 5. ProvisioningService orchestrates all steps            │
└────────────────┬─────────────────────────────────────────┘
                 ↓
        ┌────────┴────────┐
        ↓                 ↓
   ┌─────────────┐  ┌──────────────┐
   │  Database   │  │  Stellar     │
   │  Operations │  │  Blockchain  │
   └─────────────┘  └──────────────┘
        ↓                 ↓
┌──────────────────────────────────────────────────────────┐
│ 6. Store logs and results in provisioning_logs table     │
└────────────────┬─────────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────────────┐
│ 7. Update tenant record with final status                │
└────────────────┬─────────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────────────┐
│ 8. Send email notification to admin                      │
└────────────────┬─────────────────────────────────────────┘
                 ↓
┌──────────────────────────────────────────────────────────┐
│ 9. Job completed - available in job history              │
└──────────────────────────────────────────────────────────┘
```

### Status Polling Flow

```
Client
  ↓
GET /admin/tenants/:id/provisioning-status
  ↓
Controller
  ↓
ProvisioningService.getProvisioningStatus()
  ↓
Query tenant + provisioning_logs from database
  ↓
Return response with logs and overall status
  ↓
Client displays progress to user
  ↓
Client polls again (every 5-10 seconds typically)
  ↓
Status changes from PROVISIONING → ACTIVE (or FAILED)
  ↓
Client stops polling
```

## Multi-Tenancy Architecture

### Schema Isolation

Each tenant gets a dedicated PostgreSQL schema:

```
database: tenant_provisioning
├── Schema: public
│   ├── tenants (all org records)
│   ├── provisioning_logs (all provisioning events)
│   └── jwt_tokens (optional, for tokens)
│
├── Schema: acme_healthcare_corp_1708599000000
│   ├── roles
│   ├── users
│   ├── audit_logs
│   └── ... (tenant-specific tables)
│
└── Schema: blue_cross_health_1708600000000
    ├── roles
    ├── users
    ├── audit_logs
    └── ... (tenant-specific tables)
```

### Data Isolation Benefits

1. **Security**: No data leakage between tenants
2. **Performance**: Per-tenant indexes and statistics
3. **Compliance**: HIPAA/GDPR per-org compliance
4. **Scalability**: Schemas can be moved to different databases
5. **Backup**: Per-tenant backup and restore

## Error Handling Strategy

### Step-Level Error Handling

```
Try {
  Execute step
  Log: COMPLETED
} Catch {
  Log: FAILED with error message
  Rollback previous steps
  Update tenant status to FAILED
  Trigger error email
  Rethrow error to stop pipeline
}
```

### Rollback Process

```
On ANY failure:
  1. Log failed step with error details
  2. Set tenant status to FAILED
  3. Store error message on tenant record
  4. Drop the newly created schema (CASCADE)
  5. Send error notification email
  6. Mark job as failed in queue
```

### Retry Strategy

- BullMQ configured with `attempts: 1` (no automatic retry)
- Rationale: Provisioning should be idempotent or manual intervention required
- Manual retry via API possible after fixing underlying issue

## Security Architecture

### Input Validation

```
HTTP Request
    ↓
Controller @Validate (DTO)
    ↓
Type validation
Email validation
String length validation
    ↓
Valid object passed to service
OR
400 Bad Request returned
```

### SQL Injection Prevention

```
Tenant Name: "Robert'; DROP TABLE tenants; --"
    ↓
Schema Name Generation:
  - Convert to lowercase
  - Replace non-alphanumeric with underscore
  - Result: "robert_drop_table_tenants_"
    ↓
Validation: /^[a-z_][a-z0-9_]*$/
    ↓
Parameterized Query: `CREATE SCHEMA "${schemaName}"`
    ↓
Safe execution
```

### Secret Management

```
Environment Variables:
├── DB_PASSWORD (PostgreSQL)
├── REDIS_PASSWORD (Redis)
├── JWT_SECRET (Token signing)
├── MAIL_PASSWORD (Email service)
└── SOROBAN_CONTRACT_DEPLOYER_SECRET (Blockchain)

Never:
├── Logged
├── Exposed in responses
├── Committed to git
└── Visible in error messages
```

## Performance Considerations

### Queue Processing

- Default: Single processor instance
- Scalable: Add more workers as needed
- Processing time: ~10-30 seconds per tenant
- Throughput: 100+ tenants/hour per worker

### Database Optimization

- Connection pooling: TypeORM handles
- Indexes: On tenant.id, tenant.status, provisioning_logs.tenantId

### Caching Strategies

- Tenant status can be cached in Redis during provisioning
- Provisioning logs immutable (safe to cache long-term)
- Consider caching for GET /admin/tenants listing

## Monitoring & Observability

### Logging

```
ProvisioningService logs:
  - Startup: "Starting tenant provisioning for: {name}"
  - Each step:
    - Start: "Running migrations for schema..."
    - Complete: "Migrations completed for schema..."
    - Error: "Failed to deploy contract: {error}"
  - End: "Tenant provisioning completed successfully: {id}"

Levels:
  - DEBUG: Detailed operation info
  - LOG: Major milestones
  - WARN: Warnings (non-critical issues)
  - ERROR: Errors (critical issues)
```

### Metrics to Track

- Total provisioning time
- Per-step duration
- Success/failure rate
- Error types and frequencies
- Queue depth and processing time
- Database query performance

### Audit Trail

```
provisioning_logs table captures:
├── Every step execution
├── Success/failure status
├── Step duration
├── Result/error data
├── Timestamp
└── Tenant association
```

## Deployment Topology

### Development

```
Local Machine
├── Node.js app (npm start)
├── PostgreSQL (local or Docker)
└── Redis (local or Docker)
```

### Production

```
Kubernetes Cluster
├── NestJS Pods (3-5 replicas)
│   ├── Service for load balancing
│   └── HPA for auto-scaling
├── PostgreSQL (RDS or managed)
│   ├── Read replicas (optional)
│   └── Automated backups
└── Redis (ElastiCache or managed)
    ├── High availability
    └── Persistence enabled
```

## Future Enhancements

1. **GraphQL API** - In addition to REST
2. **API Gateway** - Auth, rate limiting, logging
3. **Event Streaming** - Kafka/SNS for async notifications
4. **Monitoring Stack** - Prometheus + Grafana
5. **Contract Templates** - Multiple contract types
6. **Multi-region** - Geo-redundant provisioning
7. **Webhook Support** - Client notifications
8. **Provisioning Cancellation** - Stop in-progress jobs
9. **Batch Provisioning** - Provision multiple tenants
10. **Contract Upgrades** - Update existing contracts

## Architecture Decision Records (ADRs)

### ADR-001: Use BullMQ for Job Processing

**Decision**: Use BullMQ with Redis for async job processing

**Rationale**:

- Scalable to multiple workers
- Job persistence and recovery
- Built-in retry mechanisms
- NestJS integration via @nestjs/bull
- Redis is lightweight and performant

**Alternatives Considered**:

- Direct service call (synchronous) - Would block API
- Message queues (RabbitMQ, SNS) - More complex setup

### ADR-002: PostgreSQL Schemas for Tenant Isolation

**Decision**: Use PostgreSQL schemas for multi-tenancy

**Rationale**:

- Strong data isolation
- Per-tenant scalability
- Can move to different databases
- Supports HIPAA/GDPR compliance
- Simpler than separate databases

**Alternatives Considered**:

- Separate database per tenant - More infrastructure
- Schema + application-level filtering - Higher complexity

### ADR-003: Soft Delete for Tenants

**Decision**: Archive tenants instead of hard delete

**Rationale**:

- Compliance: Audit requirements
- Recovery: Can restore archived tenants
- Reporting: Historical data available
- Schema persistence: Can query archived data

**Impact**: `DELETE /admin/tenants` sets status to ARCHIVED
