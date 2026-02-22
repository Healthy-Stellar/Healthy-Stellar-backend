# Deployment Guide - NestJS Query Optimization

Complete guide for deploying the database-optimized NestJS application to production with performance considerations.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Production Setup](#production-setup)
3. [Database Migration](#database-migration)
4. [Performance Validation](#performance-validation)
5. [Monitoring Setup](#monitoring-setup)
6. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Code Quality

- [ ] Run tests: `npm run test`
- [ ] Check coverage: `npm run test:cov`
- [ ] Lint code: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors: `npm run build` (check output)

### Configuration

- [ ] Create `.env` from `.env.example`
- [ ] Set all required environment variables
- [ ] Verify database credentials
- [ ] Set `NODE_ENV=production`
- [ ] Review connection pool settings for production load

### Performance Validation

- [ ] Run load tests: `npm run load:test`
- [ ] Verify p95 < 50ms: `npm run profile:queries`
- [ ] Check for N+1 patterns
- [ ] Monitor resource usage

### Documentation

- [ ] Review [OPTIMIZATION_REPORT.md](./OPTIMIZATION_REPORT.md)
- [ ] Review [docs/database-profiling.md](./docs/database-profiling.md)
- [ ] Update README with any deployment-specific notes
- [ ] Document database backup strategy

---

## Production Setup

### 1. Environment Configuration

Create a production `.env` file:

```bash
# Application
NODE_ENV=production
PORT=3000

# Database
DB_HOST=prod-db.example.com
DB_PORT=5432
DB_USERNAME=app_user
DB_PASSWORD=<strong-password>
DB_NAME=query_optimization_db_prod

# Connection Pool (tuned for production)
DB_POOL_MIN=75      # Start with 75 connections
DB_POOL_MAX=150     # Allow up to 150 connections
DB_SSL=true         # Use SSL for remote database

# Monitoring
LOG_LEVEL=warn      # Reduce logging in production
ENABLE_PROFILING=false  # Disable detailed profiling logging
```

### 2. PostgreSQL Superuser Setup

For the production database, ensure pg_stat_statements can be enabled:

```sql
-- Connect as superuser
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET pg_stat_statements.max = 10000;

-- Restart PostgreSQL
sudo systemctl restart postgresql

-- Create application user (limited privileges)
CREATE USER app_user WITH PASSWORD '<strong-password>';
GRANT CONNECT ON DATABASE query_optimization_db_prod TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

### 3. Build Application

```bash
# Install production dependencies only
npm ci --only=production

# Build application
npm run build

# Verify build
ls -la dist/
```

### 4. Database Preparation

```bash
# Option 1: Fresh database (development to production)
node scripts/setup-database.js

# Option 2: Migrate existing database
npm run migration:run
```

---

## Database Migration

### From Development to Production

#### 1. Backup Development Data

```bash
# Export schema
pg_dump -U postgres --schema-only query_optimization_db > schema.sql

# Export data (if needed)
pg_dump -U postgres query_optimization_db > backup.sql
```

#### 2. Create Production Database

```bash
psql -U postgres -c "CREATE DATABASE query_optimization_db_prod;"
psql -U postgres -d query_optimization_db_prod < schema.sql
```

#### 3. Apply Indices

```bash
node scripts/setup-database.js
```

#### 4. Verify Migration

```bash
psql -U postgres -d query_optimization_db_prod -c "\dt"
psql -U postgres -d query_optimization_db_prod -c "\di"
```

### From Legacy Database

If migrating from an existing database:

```bash
# 1. Run pending migrations
npm run migration:run

# 2. Add missing indices
npm run migration:generate -- -n AddMissingIndices

# 3. Test in staging first
npm run start:prod

# 4. Load test
npm run load:test
npm run profile:queries
```

---

## Performance Validation

### Pre-Production Load Test

```bash
# 1. Start application
NODE_ENV=production npm run start:prod &

# 2. Run baseline load test
BASE_URL=http://localhost:3000 npm run load:test

# 3. Run slow query focus test
BASE_URL=http://localhost:3000 npm run load:test:slow-queries

# 4. Profile and analyze
npm run profile:queries
```

### Required Metrics

**Must Pass Before Deployment:**

| Metric          | Threshold     | Status |
| --------------- | ------------- | ------ |
| p95 Query Time  | < 50ms        | ✓      |
| p99 Query Time  | < 100ms       | ✓      |
| Error Rate      | < 1%          | ✓      |
| Connection Pool | No exhaustion | ✓      |

### Monitoring Commands

```bash
# Check connection pool usage
watch -n 1 'psql -U postgres -d query_optimization_db_prod -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '"'"'query_optimization_db_prod'"'"';"'

# Watch slow queries in real-time
watch -n 1 'psql -U postgres -d query_optimization_db_prod -c "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 5;"'

# Check index usage
psql -U postgres -d query_optimization_db_prod -c "SELECT tablename, indexname, idx_scan FROM pg_stat_user_indexes ORDER BY idx_scan DESC;"
```

---

## Monitoring Setup

### 1. Application Monitoring

#### Logging Configuration

For production, use structured logging:

```typescript
// Update src/main.ts
import { Logger } from '@nestjs/common';

const logger = new Logger('Main');
logger.log(`Application started on port ${port}`);
```

#### Health Check Endpoint

```bash
curl http://localhost:3000/health
# Output: { "status": "ok", "timestamp": "2026-02-21T..." }
```

#### Metrics Export (Optional)

Consider adding Prometheus metrics:

```bash
npm install @nestjs/terminus prom-client
```

### 2. Database Monitoring

#### pg_stat_statements Monitoring

```bash
# Setup automated profiling (cron job)
0 */4 * * * /path/to/scripts/profile-queries.js >> /var/log/db-profile.log 2>&1
0 0 * * 0 /path/to/scripts/profile-queries.js >> /var/log/weekly-profile.log 2>&1
```

#### Connection Pool Monitoring

```sql
-- Create monitoring view
CREATE VIEW pg_connections_summary AS
SELECT
  datname,
  usename,
  application_name,
  count(*) as connections,
  max(now() - backend_start) as longest_connection_age
FROM pg_stat_activity
GROUP BY datname, usename, application_name
ORDER BY connections DESC;

-- Monitor periodically
SELECT * FROM pg_connections_summary;
```

#### Query Performance Alerts

Set up alerts for:

```sql
-- Queries slower than 100ms
SELECT query, mean_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 10;

-- Unused indices (growing in size)
SELECT tablename, indexname, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

### 3. Application Logs

Configure log rotation:

```bash
# /etc/logrotate.d/nestjs-app
/var/log/nestjs-app.log {
  daily
  rotate 14
  compress
  delaycompress
  notifempty
  create 0640 www-data www-data
}
```

---

## Deployment Steps

### Using Docker

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

Build and run:

```bash
docker build -t nestjs-optimization:1.0 .
docker run -p 3000:3000 \
  -e DB_HOST=prod-db.example.com \
  -e DB_PORT=5432 \
  -e DB_USERNAME=app_user \
  -e DB_PASSWORD=password \
  -e DB_NAME=query_optimization_db_prod \
  nestjs-optimization:1.0
```

### Using PM2

```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'nestjs-optimization',
    script: './dist/main.js',
    instances: '4',  # Use num_cpus
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DB_HOST: 'prod-db.example.com',
      DB_POOL_MIN: 75,
      DB_POOL_MAX: 150,
    },
  }],
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Zero-Downtime Deployment

```bash
# 1. Build new version
npm run build

# 2. Start new process on alternative port
PORT=3001 npm run start:prod &

# 3. Verify new version is healthy
curl http://localhost:3001/health

# 4. Switch traffic (using load balancer)
# Update load balancer to point to 3001

# 5. Stop old process
kill <old-pid>

# 6. Cleanup
npm prune --production
```

---

## Performance Monitoring Checklist

### Daily

- [ ] Check error rate: `npm run profile:queries`
- [ ] Verify p95 < 50ms
- [ ] Monitor connection pool usage
- [ ] Check for new slow queries

### Weekly

- [ ] Run full profiling report
- [ ] Review index usage
- [ ] Check for unused indices
- [ ] Analyze N+1 patterns

### Monthly

- [ ] Full capacity testing
- [ ] Review connection pool settings
- [ ] Plan for scaling if needed
- [ ] Update documentation

---

## Scaling Strategies

### Vertical Scaling (More Powerful Server)

- Increase connection pool size
- Increase PostgreSQL buffer pool
- Monitor CPU and memory usage

```bash
# Increase pool for higher load
DB_POOL_MIN=100 DB_POOL_MAX=200 npm run start:prod
```

### Horizontal Scaling (Multiple Instances)

```bash
# Use load balancer (nginx, HAProxy)
# Point to multiple application instances
# Share PostgreSQL connection pool intelligently
```

### Database Optimization for Scale

```sql
-- Partition large tables by date
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Archive old data
DELETE FROM audit_logs WHERE createdAt < NOW() - INTERVAL '2 years';
VACUUM ANALYZE audit_logs;
```

---

## Rollback Plan

### If Issues Detected

```bash
# 1. Identify issue
npm run profile:queries

# 2. Revert to previous version
git revert <commit-hash>
npm run build

# 3. Redeploy
NODE_ENV=production npm run start:prod

# 4. Verify
curl http://localhost:3000/health
npm run load:test
```

### Database Rollback

```bash
# Restore from backup
psql -U postgres < backup.sql

# Or if using migrations
npm run migration:revert
```

---

## Troubleshooting

### High Query Times After Deployment

**Problem:** p95 suddenly increases above 50ms

**Solution:**

```bash
# 1. Check for new slow queries
npm run profile:queries

# 2. Analyze with EXPLAIN
psql -c "EXPLAIN ANALYZE <slow-query>"

# 3. Add missing index if needed
CREATE INDEX idx_name ON table(column);

# 4. ANALYZE table statistics
ANALYZE table_name;

# 5. Retest
npm run load:test
```

### Connection Pool Exhaustion

**Problem:** "connect ECONNREFUSED" errors

**Solution:**

```bash
# 1. Check active connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# 2. Identify long-running queries
SELECT pid, query, duration FROM pg_stat_activity
WHERE duration > INTERVAL '5 minutes';

# 3. Increase pool size
DB_POOL_MAX=200 npm run start:prod

# 4. Or kill long-running queries
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE query LIKE '%slow_query%';
```

### Memory Leak Detection

```bash
# Monitor memory usage
watch -n 1 'ps aux | grep "node dist/main.js"'

# Enable heap snapshots
node --inspect dist/main.js
# Connect DevTools and capture heap dumps
```

---

## Success Criteria

Deployment is successful when:

✅ p95 query time < 50ms
✅ p99 query time < 100ms
✅ Error rate < 1%
✅ No connection pool exhaustion
✅ No N+1 query patterns
✅ All health checks passing
✅ Monitoring alerts configured
✅ Backup and recovery tested

---

## Support and Further Optimization

### References

- [OPTIMIZATION_REPORT.md](./OPTIMIZATION_REPORT.md) - Detailed optimization summary
- [docs/database-profiling.md](./docs/database-profiling.md) - Comprehensive technical guide
- [README.md](./README.md) - API documentation

### Future Enhancements

- [ ] Add Redis caching layer
- [ ] Implement materialized views
- [ ] Set up read replicas
- [ ] Add query plan caching
- [ ] Implement full-text search indexing

---

**Last Updated:** February 2026
**Status:** Ready for Production Deployment ✅
