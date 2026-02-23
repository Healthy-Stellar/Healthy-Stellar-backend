# Rate Limiting Implementation

This document describes the comprehensive rate limiting system implemented to protect the API against brute-force attacks and abuse.

## Overview

The application uses `@nestjs/throttler` with Redis-backed storage for distributed rate limiting across multiple server instances. Rate limits are tiered based on authentication status and endpoint sensitivity.

## Architecture

### Components

1. **ThrottlerConfigService** - Configures Redis storage and default limits
2. **CustomThrottlerGuard** - Enhanced guard with per-endpoint custom limits
3. **Rate Limit Decorators** - Easy-to-use decorators for common scenarios
4. **Redis Storage** - Distributed storage for multi-instance deployments

### Storage Backend

Rate limiting uses Redis for storage, enabling:
- Distributed rate limiting across multiple server instances
- Fast in-memory operations
- Automatic expiration of rate limit counters
- High availability and persistence

## Rate Limit Tiers

### 1. Global Limits (Unauthenticated)

**Default: 100 requests per minute per IP**

Applied to all unauthenticated requests by default.

```typescript
// Automatically applied via global guard
// No decorator needed
```

### 2. Authenticated User Limits

**Default: 200 requests per minute per user**

Applied to authenticated requests, tracked by:
- Stellar public key (if available)
- User ID
- Fallback to IP address

```typescript
// Automatically applied when JWT token is present
// No decorator needed
```

### 3. Authentication Endpoints

**Limit: 10 requests per minute**

Applied to sensitive authentication operations:
- `POST /auth/register` - User registration
- `POST /auth/register/staff` - Staff registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh
- `POST /auth/mfa/setup` - MFA setup

```typescript
@Post('login')
@AuthRateLimit() // 10 requests per minute
async login(@Body() loginDto: LoginDto) {
  // ...
}
```

### 4. Verification Endpoints

**Limit: 5 requests per minute**

Applied to verification operations:
- `POST /auth/mfa/verify` - MFA verification
- `POST /auth/mfa/verify-code` - MFA code verification

```typescript
@Post('verify')
@VerifyRateLimit() // 5 requests per minute
async verifyMfa(@Body() dto: MfaEnableDto) {
  // ...
}
```

### 5. Health Check Endpoints

**No Limit**

Health check endpoints skip rate limiting:
- `GET /health`

```typescript
@Get()
@SkipThrottle() // No rate limiting
check() {
  return { status: 'ok' };
}
```

## Rate Limit Headers

All responses include rate limit information:

### Standard Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1677649200
```

- **X-RateLimit-Limit**: Maximum requests allowed in the time window
- **X-RateLimit-Remaining**: Requests remaining in current window
- **X-RateLimit-Reset**: Unix timestamp when the limit resets

### Rate Limited Response (429)

When rate limit is exceeded:

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

- **Retry-After**: Seconds until the rate limit resets

## Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Optional: Full Redis URL (overrides individual settings)
REDIS_URL=redis://:password@localhost:6379/0
```

### Custom Rate Limits

Use decorators to set custom limits:

```typescript
import { RateLimit } from './common/throttler/throttler.decorator';

@Post('sensitive-operation')
@RateLimit(20, 60) // 20 requests per 60 seconds
async sensitiveOperation() {
  // ...
}
```

### Predefined Decorators

```typescript
// 10 requests per minute
@AuthRateLimit()

// 5 requests per minute
@VerifyRateLimit()

// 20 requests per minute
@SensitiveRateLimit()

// Skip rate limiting
@SkipThrottle()
```

## Tracking Strategy

### IP Address Extraction

The system properly handles requests behind proxies:

1. Check `X-Forwarded-For` header (first IP)
2. Check `X-Real-IP` header
3. Fallback to `req.ip` or `req.socket.remoteAddress`

### User Identification

For authenticated requests:

1. Stellar public key (if available)
2. User ID from JWT token
3. Fallback to IP address

## Testing

### Running Tests

```bash
# Run rate limiting tests
npm test -- test/rate-limiting.spec.ts

# Run with coverage
npm test -- test/rate-limiting.spec.ts --coverage
```

### Manual Testing

#### Test Global Limit

```bash
# Make 101 requests rapidly
for i in {1..101}; do
  curl -i http://localhost:3000/api
done
```

#### Test Auth Endpoint Limit

```bash
# Make 11 login attempts
for i in {1..11}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
```

#### Check Rate Limit Headers

```bash
curl -i http://localhost:3000/api | grep -i ratelimit
```

## Production Considerations

### 1. Redis High Availability

For production, use Redis Cluster or Sentinel:

```env
# Redis Cluster
REDIS_URL=redis://node1:6379,redis://node2:6379,redis://node3:6379

# Redis Sentinel
REDIS_SENTINELS=sentinel1:26379,sentinel2:26379,sentinel3:26379
REDIS_SENTINEL_NAME=mymaster
```

### 2. Monitoring

Monitor rate limiting metrics:
- Number of 429 responses
- Top rate-limited IPs
- Rate limit hit patterns
- Redis performance

### 3. Adjusting Limits

Adjust limits based on:
- Traffic patterns
- Server capacity
- Attack patterns
- User feedback

### 4. Whitelisting

For trusted services, consider IP whitelisting:

```typescript
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = this.getIpFromRequest(request);
    
    // Whitelist trusted IPs
    const trustedIps = ['10.0.0.1', '10.0.0.2'];
    if (trustedIps.includes(ip)) {
      return true;
    }
    
    return super.shouldSkip(context);
  }
}
```

## Troubleshooting

### Issue: Rate limits not working

**Solutions:**
1. Verify Redis is running: `redis-cli ping`
2. Check Redis connection in logs
3. Verify environment variables are set
4. Check guard is registered globally

### Issue: All requests getting rate limited

**Solutions:**
1. Check Redis storage is working
2. Verify IP extraction is correct
3. Check for clock skew issues
4. Review custom rate limit configurations

### Issue: Rate limits too strict/lenient

**Solutions:**
1. Adjust limits in decorators or config
2. Review traffic patterns
3. Consider different limits for different user tiers
4. Implement dynamic rate limiting based on user reputation

### Issue: Redis connection errors

**Solutions:**
1. Verify Redis host and port
2. Check Redis password
3. Ensure Redis is accessible from application
4. Review firewall rules

## Security Best Practices

1. **Always use Redis in production** - In-memory storage doesn't work across instances
2. **Monitor 429 responses** - High rates may indicate attacks
3. **Adjust limits based on patterns** - Different endpoints need different limits
4. **Use HTTPS** - Prevent token theft and replay attacks
5. **Log rate limit violations** - Track potential attackers
6. **Implement progressive delays** - Increase delays for repeated violations
7. **Consider CAPTCHA** - For endpoints with repeated violations

## Compliance

Rate limiting helps meet various compliance requirements:

- **HIPAA**: Protects against unauthorized access attempts
- **PCI DSS**: Prevents brute-force attacks on authentication
- **GDPR**: Protects user data from abuse
- **SOC 2**: Demonstrates access controls

## References

- [@nestjs/throttler Documentation](https://docs.nestjs.com/security/rate-limiting)
- [nestjs-throttler-storage-redis](https://github.com/kkoomen/nestjs-throttler-storage-redis)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
- [RFC 6585 - Additional HTTP Status Codes](https://tools.ietf.org/html/rfc6585)
