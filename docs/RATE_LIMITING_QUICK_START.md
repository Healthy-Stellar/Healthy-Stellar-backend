# Rate Limiting - Quick Start Guide

## What Was Implemented

✅ Redis-backed rate limiting with `@nestjs/throttler`  
✅ Global limits: 100 req/min per IP (unauthenticated)  
✅ Per-user limits: 200 req/min per Stellar public key/user ID  
✅ Auth endpoints: 10 req/min (`POST /auth/login`, `/auth/register`, etc.)  
✅ Verification endpoints: 5 req/min (`POST /auth/mfa/verify`, `/auth/mfa/verify-code`)  
✅ Health check: No limits (`GET /health`)  
✅ Rate limit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset  
✅ 429 responses include Retry-After header  

## Quick Setup

### 1. Configure Redis

Add to your `.env` file:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
```

Or use a full Redis URL:

```env
REDIS_URL=redis://:password@localhost:6379/0
```

### 2. Start Redis

```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Or using Redis CLI
redis-server
```

### 3. Start Application

```bash
npm run start:dev
```

## Quick Testing

### Test Rate Limit Headers

```bash
curl -i http://localhost:3000/api
```

Expected headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1677649200
```

### Test Global Limit (100 req/min)

```bash
# Make 101 requests
for i in {1..101}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api
done
```

Last request should return `429`.

### Test Auth Endpoint Limit (10 req/min)

```bash
# Make 11 login attempts
for i in {1..11}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n"
done
```

Last request should return `429` with `Retry-After` header.

### Test Health Check (No Limit)

```bash
# Make 200 requests - all should succeed
for i in {1..200}; do
  curl -s http://localhost:3000/health
done
```

All should return `200 OK`.

## Using Rate Limit Decorators

### In Your Controllers

```typescript
import { Controller, Post } from '@nestjs/common';
import { AuthRateLimit, VerifyRateLimit, RateLimit } from './common/throttler/throttler.decorator';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('example')
export class ExampleController {
  
  // Use predefined auth rate limit (10 req/min)
  @Post('login')
  @AuthRateLimit()
  async login() {
    // ...
  }

  // Use predefined verify rate limit (5 req/min)
  @Post('verify')
  @VerifyRateLimit()
  async verify() {
    // ...
  }

  // Custom rate limit (30 req/min)
  @Post('custom')
  @RateLimit(30, 60)
  async custom() {
    // ...
  }

  // Skip rate limiting
  @Get('health')
  @SkipThrottle()
  async health() {
    // ...
  }
}
```

## Rate Limit Tiers

| Tier | Limit | Applies To |
|------|-------|------------|
| **Unauthenticated** | 100 req/min | All requests without JWT token |
| **Authenticated** | 200 req/min | Requests with valid JWT token |
| **Auth Endpoints** | 10 req/min | `/auth/login`, `/auth/register`, etc. |
| **Verify Endpoints** | 5 req/min | `/auth/mfa/verify`, `/auth/mfa/verify-code` |
| **Health Check** | No limit | `/health` |

## Response Examples

### Normal Response (Within Limit)

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1677649200
Content-Type: application/json

{
  "data": "..."
}
```

### Rate Limited Response (429)

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1677649200
Retry-After: 45
Content-Type: application/json

{
  "statusCode": 429,
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "error": "Too Many Requests"
}
```

## Running Tests

```bash
# Run rate limiting tests
npm test -- test/rate-limiting.spec.ts

# Run all tests
npm test
```

## Common Issues

### Issue: Rate limits not working

**Check:**
1. Redis is running: `redis-cli ping` (should return `PONG`)
2. Environment variables are set correctly
3. Application logs for Redis connection errors

### Issue: Getting 429 too quickly

**Solutions:**
1. Check if you're behind a proxy (IP might be shared)
2. Verify rate limit configuration
3. Clear Redis: `redis-cli FLUSHDB`

### Issue: Health check is rate limited

**Check:**
1. Verify `@SkipThrottle()` decorator is applied
2. Check route path matches `/health`

## Monitoring

### Check Redis Keys

```bash
# Connect to Redis
redis-cli

# List all throttle keys
KEYS throttle:*

# Check specific key TTL
TTL throttle:AuthController:login:192.168.1.1:60000

# Get key value
GET throttle:AuthController:login:192.168.1.1:60000
```

### Monitor Rate Limit Hits

Check application logs for 429 responses and track:
- Which endpoints are being rate limited
- Which IPs are hitting limits
- Patterns indicating attacks

## Production Checklist

- [ ] Redis is running and accessible
- [ ] Redis password is set (production)
- [ ] Redis persistence is enabled
- [ ] Rate limits are tested and appropriate
- [ ] Monitoring is set up for 429 responses
- [ ] Health check endpoints skip rate limiting
- [ ] Documentation is updated with actual limits

## Next Steps

1. ✅ Implementation complete
2. ⏭️ Deploy to staging
3. ⏭️ Test rate limits in staging
4. ⏭️ Monitor 429 responses
5. ⏭️ Adjust limits based on traffic patterns
6. ⏭️ Deploy to production
7. ⏭️ Set up alerts for high rate limit violations

## Documentation

- Full documentation: `docs/RATE_LIMITING.md`
- Tests: `test/rate-limiting.spec.ts`
- Configuration: `src/common/throttler/throttler.config.ts`
- Custom guard: `src/common/throttler/custom-throttler.guard.ts`
- Decorators: `src/common/throttler/throttler.decorator.ts`
