# Quick Start Guide

Get the NestJS Query Optimization project up and running in 5 minutes.

## 1️⃣ Install Dependencies

```bash
npm install
```

## 2️⃣ Configure Environment

```bash
cp .env.example .env
# Edit .env if needed - defaults work for local PostgreSQL
```

## 3️⃣ Setup Database

```bash
# Create tables, indices, and test data
node scripts/setup-database.js
```

Expected output:

```
✓ Connected to PostgreSQL
✓ pg_stat_statements extension enabled
✓ Tables created/verified
✓ Indices created
✓ Test data inserted
✓ Database setup completed successfully!
```

## 4️⃣ Start Application

```bash
npm run start:dev
```

You should see:

```
[Nest] 12345  - 02/21/2026, 10:30:00 AM     LOG [NestFactory] Starting Nest application...
...
Application is running on: http://localhost:3000
```

## 5️⃣ Test the API

```bash
# Health check
curl http://localhost:3000/health

# Get audit logs
curl http://localhost:3000/audit-logs/user/550e8400-e29b-41d4-a716-446655440000

# Get records
curl http://localhost:3000/records/status/active
```

## 🚀 Run Load Test

In a new terminal:

```bash
npm run load:test
```

This will simulate load from 10 to 100 concurrent users and show performance metrics.

## 📊 Profile Queries

After load testing, analyze results:

```bash
npm run profile:queries
```

You'll see a report like:

```
═══════════════════════════════════════════════════════════════════
🐌 TOP 10 SLOWEST QUERIES (by total execution time)
═══════════════════════════════════════════════════════════════════

1. TOTAL TIME: 1234ms | CALLS: 45 | AVG: 27.4ms
   ...query details...

✅ P95 Query Time: 38ms (< 50ms target) ✓
```

## 📚 Learn More

- **[README.md](./README.md)** - Full documentation
- **[docs/database-profiling.md](./docs/database-profiling.md)** - Database optimization guide
- **[OPTIMIZATION_REPORT.md](./OPTIMIZATION_REPORT.md)** - Detailed optimization summary
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Production deployment

## 🔧 Common Commands

```bash
# Development
npm run start:dev          # Start with hot reload
npm run build             # Build production bundle
npm run start:prod        # Run production build

# Testing
npm run test              # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:cov         # Run with coverage

# Database
node scripts/setup-database.js    # Initialize database
node scripts/reset-database.js    # Completely reset (⚠️ deletes data)
node scripts/profile-queries.js   # Analyze query performance

# Load Testing
npm run load:test              # Main load test (5min, 100 users)
npm run load:test:slow-queries # Slow query focus test

# Code Quality
npm run lint              # Run ESLint
npm run format            # Format with Prettier
```

## 📦 API Quick Reference

### Audit Logs

```
GET  /audit-logs/user/{userId}?page=1&limit=20
GET  /audit-logs/date-range?startDate=...&endDate=...
GET  /audit-logs/filter?userId=...&action=...&page=1&limit=20
POST /audit-logs { userId, action, resourceType }
```

### Records

```
GET  /records/owner/{ownerId}?page=1&limit=20
GET  /records/status/{status}?page=1&limit=20
GET  /records/popular?limit=10
GET  /records/filter?ownerId=...&status=...&page=1&limit=20
PATCH /records/{id}/view
POST /records { ownerId, title, description }
```

### Health

```
GET /health
GET /
```

## 🎯 Performance Targets

All queries optimized to achieve:

- **p95 < 50ms** ✓
- **p99 < 100ms** ✓
- **Error rate < 1%** ✓

## ❓ Troubleshooting

### Database connection error

```bash
# Ensure PostgreSQL is running
sudo systemctl start postgresql

# Check connection settings in .env
# Default: localhost:5432, user: postgres
```

### Port already in use

```bash
# Use a different port
PORT=3001 npm run start:dev
```

### Load test fails

```bash
# Ensure application is running before starting load test
npm run start:dev &
sleep 2
npm run load:test
```

### Need to reset everything

```bash
# Complete reset
node scripts/reset-database.js
node scripts/setup-database.js
npm run start:dev
```

## 💡 What's Included

✅ NestJS REST API with TypeORM + PostgreSQL
✅ Optimized database queries with indices
✅ N+1 query prevention with eager loading
✅ pg_stat_statements query profiling
✅ K6 load testing suite
✅ Connection pool tuning
✅ Slow query logging (100ms threshold)
✅ Comprehensive documentation
✅ Production-ready code

## 📝 Next Steps

1. [ ] Run the application: `npm run start:dev`
2. [ ] Load test it: `npm run load:test`
3. [ ] Profile queries: `npm run profile:queries`
4. [ ] Review [OPTIMIZATION_REPORT.md](./OPTIMIZATION_REPORT.md)
5. [ ] Deploy to production using [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

**Ready to optimize? Start with:** `npm run start:dev` 🚀
