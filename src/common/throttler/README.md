# Rate Limiting Middleware

Comprehensive rate limiting system using `@nestjs/throttler` with Redis storage to prevent abuse and DDoS attacks.

## Features

- **Redis-backed storage** for distributed rate limiting
- **Category-based limits** for different endpoint types
- **IP-based tracking** for unauthenticated requests
- **JWT-based tracking** for authenticated requests
- **Automatic Retry-After headers** on 429 responses
- **Configurable per-endpoint limits**

## Rate Limit Categories

### Auth Endpoints

- **Limit**: 5 requests/minute per IP
- **Use case**: Login, registration, password reset
- **Decorator**: `@AuthRateLimit()`

```typescript
@Post('login')
@AuthRateLimit()
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

### Read Endpoints

- **Limit**: 100 requests/minute per JWT (50 for unauthenticated)
- **Use case**: GET endpoints, data retrieval
- **Decorator**: `@ReadRateLimit()`

```typescript
@Get()
@ReadRateLimit()
async findAll(@Query() query: PaginationDto) {
  return this.service.findAll(query);
}
```

### Write Endpoints

- **Limit**: 20 requests/minute per JWT (10 for unauthenticated)
- **Use case**: POST, PUT, PATCH, DELETE endpoints
- **Decorator**: `@WriteRateLimit()`

```typescript
@Post()
@WriteRateLimit()
async create(@Body() dto: CreateDto) {
  return this.service.create(dto);
}
```

### Admin Endpoints

- **Limit**: 50 requests/minute per JWT
- **Use case**: Admin-only operations
- **Decorator**: `@AdminRateLimit()`

```typescript
@Get('admin/stats')
@AdminRateLimit()
async getStats() {
  return this.adminService.getStats();
}
```

## Custom Rate Limits

For endpoints requiring custom limits:

```typescript
@Post('bulk-upload')
@RateLimit(5, 60) // 5 requests per 60 seconds
async bulkUpload(@Body() dto: BulkUploadDto) {
  return this.service.bulkUpload(dto);
}
```

## Response Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
X-RateLimit-Category: read
```

When rate limit is exceeded (429 response):

```
Retry-After: 45
```

## Configuration

Rate limits are configured in `throttler.config.ts`:

```typescript
{
  throttlers: [
    { name: 'auth', ttl: 60000, limit: 5 },
    { name: 'read', ttl: 60000, limit: 100 },
    { name: 'write', ttl: 60000, limit: 20 },
    { name: 'admin', ttl: 60000, limit: 50 },
  ],
  storage: new ThrottlerStorageRedisService(redis),
}
```

## Tracking Keys

### Unauthenticated Requests

Uses IP address with proxy support:

- `x-forwarded-for` header (first IP)
- `x-real-ip` header
- `req.ip` fallback

Key format: `throttle:{category}:{controller}:{method}:ip:{ip_address}`

### Authenticated Requests

Uses JWT subject (user ID):

Key format: `throttle:{category}:{controller}:{method}:user:{user_id}`

## Error Handling

When rate limit is exceeded, a `ThrottlerException` is thrown with:

- **Status Code**: 429 Too Many Requests
- **Message**: "Rate limit exceeded for {category} endpoints. Try again in {seconds} seconds."
- **Headers**: `Retry-After` with seconds until reset

## Testing

Run rate limiting tests:

```bash
npm test -- throttler
```

## Redis Configuration

Set environment variables:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_DB=0
```

## Best Practices

1. **Apply appropriate categories** to all endpoints
2. **Use stricter limits** for expensive operations
3. **Monitor rate limit metrics** in production
4. **Adjust limits** based on usage patterns
5. **Document custom limits** in API documentation

## Examples

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

  @Post('forgot-password')
  @RateLimit(3, 300) // 3 requests per 5 minutes
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
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

  @Delete(':id')
  @WriteRateLimit()
  async delete(@Param('id') id: string) {
    return this.recordsService.delete(id);
  }
}
```

### Admin Controller

```typescript
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  @Get('analytics')
  @AdminRateLimit()
  async getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Post('bulk-operation')
  @RateLimit(10, 60) // Custom limit for expensive operation
  async bulkOperation(@Body() dto: BulkOperationDto) {
    return this.adminService.bulkOperation(dto);
  }
}
```

## Monitoring

Track rate limiting metrics:

```typescript
// In your metrics service
this.prometheusService.registerCounter({
  name: 'rate_limit_exceeded_total',
  help: 'Total number of rate limit exceeded errors',
  labelNames: ['category', 'endpoint'],
});
```

## Troubleshooting

### Rate limits not working

- Verify Redis connection
- Check guard is registered globally in `app.module.ts`
- Ensure decorators are applied correctly

### Too many 429 errors

- Review and adjust rate limits
- Check for legitimate high-traffic patterns
- Consider implementing request queuing

### Different limits per user tier

Extend the guard to check user subscription level:

```typescript
protected getRateLimitConfig(category, isAuthenticated, user) {
  if (user?.tier === 'premium') {
    return { limit: 200, ttl: 60000 };
  }
  // ... default logic
}
```
