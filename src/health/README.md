# Health Check Implementation

## Installation

Install required dependencies:

```bash
npm install @nestjs/terminus @nestjs/axios axios redis
```

## Environment Variables

Add to your `.env` file:

```env
REDIS_URL=redis://localhost:6379
IPFS_URL=http://localhost:5001
Run the following command to install required dependencies:

```bash
npm install @nestjs/terminus @nestjs/axios axios ioredis
```

## Configuration

Add the following to your `.env` file:

```env
# IPFS Configuration
IPFS_API_URL=http://localhost:5001

# Stellar Horizon URL (already exists)
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

## Endpoints

- `GET /health` - Liveness probe (always returns ok)
- `GET /health/ready` - Readiness probe (checks all dependencies)

## Response Format

- `GET /health` - Liveness probe (checks database only)
- `GET /health/ready` - Readiness probe (checks all dependencies: PostgreSQL, Redis, IPFS, Stellar)

## Response Format

Success (200):
```json
{
  "status": "ok",
  "info": {
    "postgres": {
      "status": "up",
      "responseTime": "5ms"
    },
    "redis": {
      "status": "up",
      "responseTime": "3ms"
    },
    "ipfs": {
      "status": "up",
      "responseTime": "12ms"
    },
    "stellar": {
      "status": "up",
      "responseTime": "45ms"
    }
  },
  "error": {},
  "details": {
    "postgres": {
      "status": "up",
      "responseTime": "5ms"
    },
    "redis": {
      "status": "up",
      "responseTime": "3ms"
    },
    "ipfs": {
      "status": "up",
      "responseTime": "12ms"
    },
    "stellar": {
      "status": "up",
      "responseTime": "45ms"
    }
  }
}
```

Returns HTTP 503 if any dependency is down.
    "database": { "status": "up", "responseTime": "15ms" },
    "redis": { "status": "up", "responseTime": "8ms" },
    "ipfs": { "status": "up", "responseTime": "45ms" },
    "stellar": { "status": "up", "responseTime": "120ms" }
  },
  "error": {},
  "details": {
    "database": { "status": "up", "responseTime": "15ms" },
    "redis": { "status": "up", "responseTime": "8ms" },
    "ipfs": { "status": "up", "responseTime": "45ms" },
    "stellar": { "status": "up", "responseTime": "120ms" }
  }
}
```

Failure (503):
```json
{
  "status": "error",
  "info": {
    "database": { "status": "up", "responseTime": "15ms" }
  },
  "error": {
    "redis": { "status": "down", "responseTime": "5002ms", "error": "Connection timeout" }
  },
  "details": {
    "database": { "status": "up", "responseTime": "15ms" },
    "redis": { "status": "down", "responseTime": "5002ms", "error": "Connection timeout" }
  }
}
```

## Features

✅ Liveness probe for basic system health
✅ Readiness probe for all dependencies
✅ Custom health indicators for PostgreSQL, Redis, IPFS, and Stellar
✅ Response time tracking for each service
✅ 503 status code when critical dependency is down
✅ Excluded from JWT authentication
✅ Excluded from audit logging (via @Public decorator)
