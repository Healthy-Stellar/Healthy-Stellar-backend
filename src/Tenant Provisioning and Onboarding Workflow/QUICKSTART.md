# Quick Start Guide

## Prerequisites

- Node.js 18+ (https://nodejs.org/)
- PostgreSQL 12+ (https://www.postgresql.org/)
- Redis 6+ (https://redis.io/)
- Git
- npm or yarn

## 5-Minute Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your local PostgreSQL credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=tenant_provisioning
```

### 3. Start PostgreSQL & Redis

**Option A: Using Docker Compose**

```bash
docker-compose up -d
```

**Option B: Local Installation**

```bash
# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql

# Start Redis (macOS with Homebrew)
brew services start redis

# On Windows, use SQL Server Management Studio or WSL
```

### 4. Build & Start

```bash
npm run build
npm run start:dev
```

The application will run on `http://localhost:3000`

## Testing the API

### 1. Queue a Provisioning Job

```bash
curl -X POST http://localhost:3000/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Healthcare Org",
    "adminEmail": "admin@testhc.local",
    "adminFirstName": "John",
    "adminLastName": "Doe"
  }'
```

Note the `jobId` from the response.

### 2. Check Provisioning Status

```bash
curl -X GET http://localhost:3000/admin/tenants/{tenantId}/provisioning-status
```

Replace `{tenantId}` with the tenant ID from the previous response.

### 3. List All Tenants

```bash
curl -X GET http://localhost:3000/admin/tenants
```

### 4. Archive a Tenant

```bash
curl -X DELETE http://localhost:3000/admin/tenants/{tenantId}
```

## Development Workflow

### Run Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

### Code Quality

```bash
# Lint
npm run lint

# Format code
npm run format
```

### Database Commands

```bash
# Create new migration
npm run migration:create -- -n CreateTenantsTable

# Generate migration from entities
npm run migration:generate -- -n AutoMigration

# Run migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

## Common Tasks

### View Provisioning Logs in Database

```bash
psql -h localhost -U postgres -d tenant_provisioning

SELECT * FROM public.provisioning_logs
WHERE tenant_id = '<tenant-id>'
ORDER BY created_at DESC;
```

### Check Job Queue

```bash
redis-cli
> KEYS "bull:provisioning:*"
> HGETALL bull:provisioning:data
> LRANGE bull:provisioning:1-20 0 -1  # View jobs
```

### View Tenant Data

```bash
psql -h localhost -U postgres -d tenant_provisioning

SELECT id, name, schema_name, status, created_at FROM public.tenants;
```

### Connect to Tenant Schema

```bash
# After a tenant is provisioned
psql -h localhost -U postgres -d tenant_provisioning -c "SET search_path TO {schema_name}; SELECT * FROM roles;"
```

### Clear Job Queue

```bash
redis-cli
> FLUSHDB  # WARNING: Clears all Redis data!
```

## Troubleshooting

### Issue: "connect ECONNREFUSED" for PostgreSQL

**Solution**:

- Ensure PostgreSQL is running: `pg_isready`
- Check DB credentials in `.env`
- Try: `psql -h localhost -U postgres -c "SELECT 1"`

### Issue: "Redis connection refused"

**Solution**:

- Ensure Redis is running: `redis-cli ping`
- Check Redis host/port in `.env`
- If using Docker: `docker exec -it tenant_provisioning_redis redis-cli ping`

### Issue: Jobs stay in queue indefinitely

**Solution**:

- Check application logs for errors
- Verify all services are running
- Check Redis connection
- Restart BullMQ: `redis-cli FLUSHDB`

### Issue: Database errors about schema or tables

**Solution**:

- Run migrations: `npm run migration:run`
- Check TypeORM configuration in `.env`
- Try: `psql -h localhost -U postgres -d tenant_provisioning -c "\\dt"`

### Issue: Email not sending

**Solution**:

- Use MailHog for development (included in docker-compose)
- Web UI at `http://localhost:8025`
- Check MAIL\_\* settings in `.env`
- For Gmail: Enable "Less secure apps" and use app password

## Project Structure

```
src/
├── database/          # Database configuration
├── tenants/          # Tenant provisioning module
│   ├── controllers/   # HTTP endpoints
│   ├── services/      # Business logic
│   ├── entities/      # Database models
│   ├── dto/          # Data validation
│   ├── processors/    # Job processing
│   └── tenants.module.ts
├── app.module.ts     # Root module
└── main.ts          # Application entry

test/                # Tests
├── tenants.e2e-spec.ts
├── provisioning.service.spec.ts
└── jest-e2e.json
```

## Next Steps

1. **Read the full README** for architecture and detailed documentation
2. **Check API.md** for complete API reference
3. **Review test files** to understand expected behavior
4. **Explore the code** - start with `src/app.module.ts`
5. **Set up IDE** - VS Code recommended with ESLint and Prettier extensions

## Environment Setup for IDE

### VS Code Extensions

- ESLint
- Prettier - Code formatter
- TypeScript Vue Plugin (Volar)
- REST Client (for testing API)
- Database Client (optional)

### Launch Configuration (.vscode/launch.json)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "program": "${workspaceFolder}/dist/main.js",
      "preLaunchTask": "npm: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

## Useful Commands

```bash
# Clean rebuild
npm run prebuild && npm run build

# Format all code
npm run format

# Run linter and fix issues
npm run lint

# Full test suite
npm run test:cov

# Start with debugging
npm run start:debug

# Production build
npm run build && npm run start:prod
```

## Good to Know

- Default admin password is set to "DefaultPassword123!" - admin should change on first login
- Email sending in development uses MailHog (no real emails sent)
- Tenant schema names are auto-generated: `{name_slug}_{timestamp}`
- All provisioning steps are logged in `provisioning_logs` table
- Failed provisioning triggers automatic schema rollback
- Use soft-delete for tenants (archived, not permanently deleted)

## Support

For issues:

1. Check the logs: `npm run start:dev` and watch console output
2. Review error messages in provisioning_logs table
3. Check test files for expected behavior
4. Read the full README.md for detailed documentation
5. Contact support@healthcare.local

Happy provisioning! 🚀
