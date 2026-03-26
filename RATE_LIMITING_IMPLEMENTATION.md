# Rate Limiting Implementation Summary

## Overview

Implemented comprehensive API rate limiting using `@nestjs/throttler` with Redis storage to prevent abuse and DDoS attacks. The system provides category-based rate limits with different thresholds for authentication, read, write, and admin endpoints.

## Implementation Details

### 1. Configuration (`src/common/throttler/throttler.config.ts`)

Configured ThrottlerModule with Redis storage and multiple rate limit categories:

- **Default**: 100 requests/minute
- **Auth**: 5 requests/minute per IP
- **Read**: 100 requests/minute per JWT
- **Write**: 20 requests/minute per JWT
- **Admin**: 50 requests/minute per JWT

### 2. Custom Guard (`src/common/throttler/custom-throttler.guard.ts`)

Enhanced throttler guard with:

- **IP-based tracking** for unauthenticated requests (supports proxies)
- **JWT-based tracking** for authenticated requests (uses user ID)
- **Category-aware rate limiting** with different limits per endpoint type
- **Automatic header management** (X-RateLimit-\*, Retry-After)
- **Detailed error messages** including category and retry time

### 3. Decorators (`src/common/throttler/throttler.decorator.ts`)

Created convenient decorators for applying rate limits:

```typescript
@AuthRateLimit()    // 5 req/min for auth endpoints
@ReadRateLimit()    // 100 req/min for read endpoints
@WriteRateLimit()   // 20 req/min for write endpoints
@AdminRateLimit()   // 50 req/min for admin endpoints
@RateLimit(n, ttl)  // Custom limits
```

### 4. Response Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
X-RateLimit-Category: read
```

When rate limit exceeded (429 response):

```
Retry-After: 45
```

## Rate Limit Categories

### Auth Endpoints (5 req/min per IP)

- Login
- Registration
- Password reset
- Email verification
- MFA operations

**Rationale**: Strict limits prevent brute force attacks and credential stuffing.

### Read Endpoints (100 req/min per JWT)

- GET requests
- Data retrieval
- Search operations
- List endpoints

**Rationale**: Higher limits for read operations as they're less resource-intensive.

### Write Endpoints (20 req/min per JWT)

- POST, PUT, PATCH, DELETE requests
- Data creation/modification
- File uploads
- Bulk operations

**Rationale**: Moderate limits prevent spam and resource exhaustion.

### Admin Endpoints (50 req/min per JWT)

- Admin-only operations
- Analytics
- System management
- Bulk operations

**Rationale**: Balanced limits for administrative tasks.

## Tracking Keys

### Unauthenticated Requests

Uses IP address with proxy support:

- Checks `x-forwarded-for` header (first IP)
- Falls back to `x-real-ip` header
- Uses `req.ip` as final fallback

Key format: `throttle:{category}:{controller}:{method}:ip:{ip_address}`

### Authenticated Requests

Uses JWT subject (user ID):

Key format: `throttle:{category}:{controller}:{method}:user:{user_id}`

## Usage Examples

### Authentication Controller

```typescript
@Controller('auth')
export class AuthController {
  @Post('login')
  @AuthRateLimit()
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  @AuthRateLimit()
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
}
```

### Records Controller

```typescript
@Controller('records')
export class RecordsController {
  @Get()
  @ReadRateLimit()
  async findAll(@Query() query: PaginationDto) {
    return this.recordsService.findAll(query);
  }

  @Post()
  @WriteRateLimit()
  async create(@Body() dto: CreateRecordDto) {
    return this.recordsService.create(dto);
  }
}
```

### Admin Controller

```typescript
@Controller('admin')
export class AdminController {
  @Get('analytics')
  @AdminRateLimit()
  async getAnalytics() {
    return this.adminService.getAnalytics();
  }
}
```

## Testing

### Unit Tests

- `custom-throttler.guard.spec.ts`: Guard logic and key generation
- `throttler.config.spec.ts`: Configuration validation
- `throttler.decorator.spec.ts`: Decorator metadata

### Integration Tests

- `throttler.integration.spec.ts`: End-to-end rate limiting behavior

Run tests:

```bash
npm test -- throttler
```

## Configuration

### Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_DB=0
```

### Global Guard Registration

The guard is registered globally in `app.module.ts`:

```typescript
{
  provide: APP_GUARD,
  useClass: CustomThrottlerGuard,
}
```

## Error Handling

When rate limit is exceeded:

**Status Code**: 429 Too Many Requests

**Response**:

```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded for auth endpoints. Try again in 45 seconds."
}
```

**Headers**:

```
Retry-After: 45
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640000045
```

## Benefits

1. **DDoS Protection**: Prevents overwhelming the server with requests
2. **Brute Force Prevention**: Limits authentication attempts
3. **Resource Management**: Controls expensive operations
4. **Fair Usage**: Ensures equitable access for all users
5. **Distributed Support**: Redis storage enables multi-instance deployments

## Monitoring

Track rate limiting metrics:

```typescript
// Prometheus metrics
rate_limit_exceeded_total{category="auth",endpoint="/auth/login"}
rate_limit_requests_total{category="read",endpoint="/records"}
```

## Future Enhancements

1. **User tier-based limits**: Premium users get higher limits
2. **Dynamic limits**: Adjust based on system load
3. **Whitelist/Blacklist**: IP-based access control
4. **Rate limit bypass**: For internal services
5. **Burst allowance**: Allow short bursts above limit

## Files Created/Modified

### Created

- `src/common/throttler/custom-throttler.guard.ts`
- `src/common/throttler/custom-throttler.guard.spec.ts`
- `src/common/throttler/throttler.config.ts`
- `src/common/throttler/throttler.config.spec.ts`
- `src/common/throttler/throttler.decorator.ts`
- `src/common/throttler/throttler.decorator.spec.ts`
- `src/common/throttler/throttler.integration.spec.ts`
- `src/common/throttler/README.md`

### Modified

- `src/app.module.ts`: Updated guard import path

## Dependencies

Already installed:

- `@nestjs/throttler`: ^6.5.0
- `nestjs-throttler-storage-redis`: ^0.5.1
- `ioredis`: ^5.9.3

## Acceptance Criteria ✅

- [x] ThrottlerModule configured with Redis storage
- [x] Custom rate limits per endpoint category
- [x] Auth endpoints: 5 requests/minute per IP
- [x] Read endpoints: 100 requests/minute per JWT
- [x] Write endpoints: 20 requests/minute per JWT
- [x] Admin endpoints: 50 requests/minute per JWT
- [x] Returns 429 with Retry-After header
- [x] Rate limit keys include IP for unauthenticated
- [x] Rate limit keys include JWT sub for authenticated
- [x] Comprehensive unit tests
- [x] Integration tests
- [x] Documentation

## Next Steps

1. Apply decorators to all controllers:
   - Auth controllers: `@AuthRateLimit()`
   - Read endpoints: `@ReadRateLimit()`
   - Write endpoints: `@WriteRateLimit()`
   - Admin endpoints: `@AdminRateLimit()`

2. Monitor rate limit metrics in production

3. Adjust limits based on actual usage patterns

4. Consider implementing user tier-based limits
