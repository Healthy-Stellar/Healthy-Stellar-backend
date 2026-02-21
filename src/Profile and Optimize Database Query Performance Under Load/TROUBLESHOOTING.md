# Troubleshooting Guide

Common issues and solutions for the NestJS Query Optimization project.

## Installation Issues

### npm install fails

**Problem:** `npm install` gives errors

**Solutions:**

```bash
# Clear cache
npm cache clean --force
rm -rf node_modules package-lock.json

# Try again with verbose output
npm install --verbose

# Use npm ci for exact versions
npm ci
```

### Node version mismatch

**Problem:** "Node version X is not supported"

**Solution:**

```bash
# Check Node version (need 16+)
node --version

# Update Node if needed
# macOS (using brew)
brew install node@18

# Windows: Download from nodejs.org or use nvm-windows
```

---

## Database Connection Issues

### "connect ECONNREFUSED"

**Problem:** Cannot connect to PostgreSQL

**Solutions:**

1. **Check PostgreSQL is running:**

   ```bash
   # macOS
   brew services list | grep postgres

   # Linux
   sudo systemctl status postgresql

   # Windows
   # Check Services app for PostgreSQL service
   ```

2. **Verify credentials in .env:**

   ```bash
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=password
   ```

3. **Ensure database exists:**

   ```bash
   psql -U postgres -c "CREATE DATABASE query_optimization_db;"
   ```

4. **Check if port is in use:**

   ```bash
   # macOS/Linux
   lsof -i :5432

   # Windows
   netstat -ano | findstr :5432
   ```

### "Error: permission denied for schema public"

**Problem:** User doesn't have required permissions

**Solution:**

```sql
-- Connect as superuser
psql -U postgres -d query_optimization_db

-- Grant permissions
GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
```

---

## Setup and Database Issues

### "pg_stat_statements not found"

**Problem:** Extension not available after setup

**Solution:**

```sql
-- Check if installed
SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_stat_statements');

-- If not, install (requires superuser)
CREATE EXTENSION pg_stat_statements;

-- Verify postgresql.conf has:
-- shared_preload_libraries = 'pg_stat_statements'

-- Then restart PostgreSQL:
sudo systemctl restart postgresql
```

### Setup script fails

**Problem:** `node scripts/setup-database.js` terminates with error

**Solution:**

```bash
# Ensure database exists
psql -U postgres -c "CREATE DATABASE query_optimization_db;"

# Reset database first
node scripts/reset-database.js  # Answer 'yes' when prompted

# Try setup again
node scripts/setup-database.js
```

### Indices not created

**Problem:** Setup succeeds but indices missing

**Solution:**

```sql
-- Check what indices exist
\di

-- Manually create missing ones
CREATE INDEX idx_audit_logs_user_id ON audit_logs(userId);
CREATE INDEX idx_records_owner_id ON records(ownerId);
-- ... (see src/modules/*/entities/*.entity.ts for full list)

-- Analyze tables
ANALYZE;
```

---

## Application Runtime Issues

### "Port 3000 already in use"

**Problem:** Cannot start application

**Solutions:**

```bash
# Use different port
PORT=3001 npm run start:dev

# Or kill process using port (macOS/Linux)
lsof -ti:3000 | xargs kill -9

# Windows: kill process using port
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### "Cannot find module" errors

**Problem:** TypeScript/JavaScript module not found

**Solution:**

```bash
# Rebuild TypeScript
npm run build

# Or clear and reinstall
rm -rf dist node_modules
npm install
npm run build
```

### Application crashes on startup

**Problem:** Application starts and immediately crashes

**Solutions:**

1. **Check for TypeScript errors:**

   ```bash
   npm run build  # Shows all TS errors
   ```

2. **Enable verbose logging:**

   ```bash
   NODE_ENV=development npm run start:dev 2>&1 | tee app.log
   ```

3. **Check database connection:**
   ```bash
   node -e "const { Client } = require('pg');
   const c = new Client({host:'localhost',user:'postgres'});
   c.connect().then(() => console.log('✓ Connected')).catch(e => console.error(e));"
   ```

---

## Query Performance Issues

### "p95 query time exceeds 50ms"

**Problem:** Load test shows slow queries

**Solution:**

1. **Run profiler:**

   ```bash
   npm run profile:queries
   ```

2. **Identify slow query from report**

3. **Analyze with EXPLAIN:**

   ```sql
   EXPLAIN ANALYZE
   SELECT ... FROM table WHERE ...;
   ```

4. **Check for Sequential Scan:**
   - If yes → Missing index
   - Create index on WHERE/ORDER BY columns

5. **Check for N+1 pattern:**
   - Look for repeated similar queries
   - Use QueryBuilder with explicit joins

6. **Retest:**
   ```bash
   npm run load:test
   npm run profile:queries
   ```

### "N+1 queries detected"

**Problem:** Profiler shows repeated query patterns

**Solution:**

In the slow query log, if you see:

```
query: SELECT ... FROM records ... took 5ms
query: SELECT ... FROM users WHERE id = $1 ... took 8ms  ← MANY TIMES
```

**Fix:**

```typescript
// BEFORE (Bad - N+1)
const records = await recordRepository.find();
for (const record of records) {
  console.log(record.owner.firstName); // Extra query!
}

// AFTER (Good - Single query)
const records = await recordRepository
  .createQueryBuilder('record')
  .leftJoinAndSelect('record.owner', 'owner')
  .getMany();
```

### "Connection pool exhaustion"

**Problem:** Errors about no available connections

**Solution:**

1. **Check pool usage:**

   ```bash
   psql -c "SELECT count(*) FROM pg_stat_activity;"
   ```

2. **Increase pool size:**

   ```bash
   DB_POOL_MAX=200 npm run start:dev
   ```

3. **Find long-running queries:**

   ```sql
   SELECT pid, query, duration FROM pg_stat_activity
   WHERE duration > INTERVAL '5 minutes'
   ORDER BY duration DESC;
   ```

4. **Kill specific connection (if safe):**
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE query LIKE '%specific_query%';
   ```

---

## Load Testing Issues

### "Load test won't start"

**Problem:** `npm run load:test` fails

**Solutions:**

1. **Ensure application is running:**

   ```bash
   npm run start:dev &
   sleep 2
   npm run load:test
   ```

2. **Verify k6 is installed:**

   ```bash
   k6 version
   # If not: install from https://k6.io/docs/getting-started/installation/
   ```

3. **Check network connectivity:**
   ```bash
   curl http://localhost:3000/health
   # Should return 200 OK
   ```

### "Load test shows high error rate"

**Problem:** Many requests failing during load test

**Solutions:**

1. **Check application logs:**

   ```bash
   # Terminal running npm run start:dev
   # Look for error messages
   ```

2. **Check database connection pool:**

   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```

   If approaching max, increase pool size

3. **Check for slow queries:**

   ```bash
   npm run profile:queries
   ```

4. **Monitor memory usage:**
   ```bash
   # During load test, in another terminal
   watch -n 1 'ps aux | grep "node dist/main"'
   ```

### "Load test metrics look bad"

**Problem:** p95 > 50ms, high percentiles

**Solution:**

1. **Run profiler:**

   ```bash
   npm run profile:queries
   ```

2. **A. If bottom table shows index scans:**
   - Good - index is being used

3. **B. If you see Sequential Scans:**
   - Missing index
   - Create index: `CREATE INDEX ... ON table(column);`

4. **C. If you see repeated queries:**
   - N+1 issue
   - Use QueryBuilder with joins

5. **D. If cache hit ratio low:**
   - Queries not being cached
   - Check cache configuration

---

## Monitoring and Debugging

### View slow queries in real-time

```bash
# Terminal 1: Start app
npm run start:dev

# Terminal 2: Watch slow queries
watch -n 1 'psql -c "SELECT substring(query,1,80), calls, mean_time
FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 5;"'
```

### Export query stats

```bash
# Export to CSV
psql -c "COPY (SELECT query, calls, mean_time FROM pg_stat_statements
ORDER BY mean_time DESC) TO STDOUT WITH CSV" > queries.csv

# Open in Excel/Sheets for analysis
```

### Analyze specific query

```bash
psql -c "EXPLAIN ANALYZE
SELECT * FROM audit_logs
WHERE userId = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY createdAt DESC LIMIT 20;"
```

---

## Database Maintenance

### Database is growing too large

**Problem:** Disk usage increasing

**Solution:**

```sql
-- Check table sizes
SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Archive old data
DELETE FROM audit_logs WHERE createdAt < NOW() - INTERVAL '1 year';

-- Reclaim space
VACUUM ANALYZE;
```

### Query becoming slower over time

**Problem:** Same query previously fast, now slow

**Solution:**

```bash
# 1. Analyze statistics
psql -c "ANALYZE table_name;"

# 2. Check for bloat
psql -c "SELECT n_live_tup, n_dead_tup FROM pg_stat_user_tables
WHERE relname = 'table_name';"

# 3. If high dead rows, vacuum
psql -c "VACUUM table_name;"

# 4. Reset query stats and retest
psql -c "SELECT pg_stat_statements_reset();"
npm run load:test
npm run profile:queries
```

---

## Production Issues

### High memory usage

**Problem:** Memory usage increasing

**Solutions:**

1. **Monitor memory:**

   ```bash
   watch -n 5 'free -h'
   ```

2. **Check Node process:**

   ```bash
   ps aux | grep node
   ```

3. **Identify memory leak:**
   - Enable heap profiling
   - Compare dumps over time

4. **Restart application:**
   ```bash
   pm2 restart app
   ```

### Sudden performance drop

**Problem:** Queries suddenly slow

**Solutions:**

1. **Check CPU usage:**

   ```bash
   top  # or htop
   ```

2. **Check database locks:**

   ```sql
   SELECT * FROM pg_stat_activity WHERE wait_event_type IS NOT NULL;
   ```

3. **Profile queries:**

   ```bash
   npm run profile:queries
   ```

4. **Check cache hit ratio:**
   ```sql
   SELECT sum(heap_blks_read) as heap_read, sum(heap_blks_hit) as heap_hit,
   sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
   FROM pg_statio_user_tables;
   ```

---

## Getting Help

### Check Documentation

- **Quick setup:** [QUICKSTART.md](./QUICKSTART.md)
- **Technical details:** [docs/database-profiling.md](./docs/database-profiling.md)
- **Deployment:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md)

### Debug with Logs

```bash
# Enable debug logging
DEBUG=* npm run start:dev

# Save logs to file
npm run start:dev 2>&1 | tee app.log

# View log
tail -f app.log | grep -i error
```

### Useful Commands for Debugging

```bash
# Test database
psql -U postgres query_optimization_db

# Check extensions
\dx

# List tables
\dt

# List indices
\di

# Check query status
\timing on
SELECT ...;
\timing off

# Export stats
\copy pg_stat_statements TO 'stats.csv' WITH CSV HEADER
```

---

## Still Having Issues?

1. **Review the relevant documentation** for your issue
2. **Check application logs** for error messages
3. **Run profiler** to identify bottlenecks
4. **Check PostgreSQL logs** for database errors
5. **Verify configuration** in .env file
6. **Reset and retry:**
   ```bash
   node scripts/reset-database.js
   node scripts/setup-database.js
   npm run start:dev
   ```

---

**Last Updated:** February 2026
**Version:** 1.0
