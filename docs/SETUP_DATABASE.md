# Database Setup Guide

## Quick Start

The project uses Docker Compose to run PostgreSQL. Here's how to set it up:

### 1. Start the Database

```bash
# Start only the PostgreSQL service
docker-compose up -d postgres

# Or start all services
docker-compose up -d
```

### 2. Verify Database is Running

```bash
# Check if PostgreSQL container is running
docker-compose ps postgres

# Check database health
docker-compose exec postgres pg_isready -U medical_user -d healthy_stellar
```

### 3. Run Migrations

```bash
# Run database migrations
npm run migration:run
```

### 4. Run Benchmarks

```bash
# Now you can run the benchmark script
npm run benchmark:db
```

## Environment Variables

The benchmark scripts read from environment variables. Create a `.env` file:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=medical_user
DB_PASSWORD=your_password_here
DB_NAME=healthy_stellar
```

Or export them:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_USERNAME=medical_user
export DB_PASSWORD=$(cat secrets/db_password.txt)
export DB_NAME=healthy_stellar
```

## Troubleshooting

### Error: ECONNREFUSED 127.0.0.1:5432

This means PostgreSQL is not running. Solutions:

1. **Start Docker Compose**:
   ```bash
   docker-compose up -d postgres
   ```

2. **Check if running**:
   ```bash
   docker-compose ps
   ```

3. **View logs**:
   ```bash
   docker-compose logs postgres
   ```

### Error: Authentication Failed

Check your password in `secrets/db_password.txt` matches your environment variable.

### Port Already in Use

If port 5432 is already in use:

```bash
# Find what's using the port
sudo lsof -i :5432

# Or change the port in docker-compose.yml
ports:
  - "5433:5432"  # Map to different host port
```

Then update your `.env`:
```bash
DB_PORT=5433
```

## Development Workflow

### Start Development Environment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

### Access Database Directly

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U medical_user -d healthy_stellar

# Run SQL commands
\dt  # List tables
\di  # List indexes
\q   # Quit
```

### Backup and Restore

```bash
# Backup
docker-compose exec postgres pg_dump -U medical_user healthy_stellar > backup.sql

# Restore
docker-compose exec -T postgres psql -U medical_user healthy_stellar < backup.sql
```

## Production Deployment

For production, ensure:

1. **Secrets are properly configured**:
   ```bash
   ./generate-secrets.sh
   ```

2. **SSL/TLS is enabled** in `docker/postgres/postgresql.conf`

3. **Backups are scheduled** via the backup service

4. **Monitoring is active** (Prometheus, Grafana)

## Testing

### Run Tests with Test Database

```bash
# Set test environment
export NODE_ENV=test
export DB_NAME=healthy_stellar_test

# Create test database
docker-compose exec postgres psql -U medical_user -c "CREATE DATABASE healthy_stellar_test;"

# Run migrations
npm run migration:run

# Run tests
npm run test
```

## Performance Benchmarking

### Before Running Benchmarks

1. Ensure database has data:
   ```bash
   # Seed test data (if available)
   npm run seed:test
   ```

2. Warm up the database:
   ```bash
   # Run a few queries first
   docker-compose exec postgres psql -U medical_user healthy_stellar -c "SELECT COUNT(*) FROM medical_records;"
   ```

3. Run benchmarks:
   ```bash
   npm run benchmark:db > benchmark-results.txt
   ```

### Analyze Query Plans

```bash
npm run explain:queries > query-plans.txt
```

## Common Commands

```bash
# Start database only
docker-compose up -d postgres

# Stop database
docker-compose stop postgres

# Restart database
docker-compose restart postgres

# View database logs
docker-compose logs -f postgres

# Access database shell
docker-compose exec postgres psql -U medical_user healthy_stellar

# Check database size
docker-compose exec postgres psql -U medical_user healthy_stellar -c "SELECT pg_size_pretty(pg_database_size('healthy_stellar'));"

# List all indexes
docker-compose exec postgres psql -U medical_user healthy_stellar -c "\di"

# Check index usage
docker-compose exec postgres psql -U medical_user healthy_stellar -c "SELECT * FROM pg_stat_user_indexes;"
```
