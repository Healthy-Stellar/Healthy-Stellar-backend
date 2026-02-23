# Rate Limiting Implementation Checklist

## Pre-Deployment Checklist

### Code Implementation ✅
- [x] ThrottlerModule configured with Redis storage
- [x] ThrottlerConfigService created
- [x] CustomThrottlerGuard implemented
- [x] Rate limit decorators created (@AuthRateLimit, @VerifyRateLimit)
- [x] Global guard registered in AppModule
- [x] Global limits: 100 req/min per IP
- [x] Per-user limits: 200 req/min per Stellar key/user ID
- [x] Auth endpoints limited to 10 req/min
- [x] Verify endpoints limited to 5 req/min
- [x] Health check endpoints skip throttling
- [x] Rate limit headers implemented
- [x] Retry-After header in 429 responses
- [x] Proper IP extraction for proxies

### Testing ✅
- [x] Integration tests created
- [x] Test suite covers all rate limit tiers
- [x] Header verification tests included
- [x] Documentation created

### Configuration ✅
- [x] Environment variables documented in .env.example
- [x] Redis configuration added
- [x] Support for both individual params and Redis URL

## Deployment Checklist

### Before Deployment

#### Redis Setup
- [ ] Redis server installed and running
- [ ] Redis password configured (production)
- [ ] Redis persistence enabled (RDB or AOF)
- [ ] Redis accessible from application servers
- [ ] Firewall rules configured for Redis port

#### Environment Configuration
- [ ] Update `.env` with Redis connection details
- [ ] Set REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
- [ ] Or set REDIS_URL for full connection string
- [ ] Verify Redis connection: `redis-cli ping`

#### Application Testing
- [ ] Application starts without errors
- [ ] Redis connection successful (check logs)
- [ ] Run test suite: `npm test -- test/rate-limiting.spec.ts`
- [ ] Manual testing of rate limits

### After Deployment to Staging

#### Functional Testing
- [ ] Test global rate limit (100 req/min)
- [ ] Test authenticated user limit (200 req/min)
- [ ] Test auth endpoint limits (10 req/min)
- [ ] Test verify endpoint limits (5 req/min)
- [ ] Verify health check skips throttling
- [ ] Check rate limit headers in responses
- [ ] Verify 429 response includes Retry-After

#### Load Testing
- [ ] Simulate high traffic scenarios
- [ ] Verify Redis handles load
- [ ] Check for memory leaks
- [ ] Monitor Redis memory usage
- [ ] Test rate limit reset behavior

#### Monitoring Setup
- [ ] Set up monitoring for 429 responses
- [ ] Track rate limit violations by endpoint
- [ ] Monitor Redis performance metrics
- [ ] Set up alerts for high violation rates
- [ ] Log rate limit events for analysis

### After Deployment to Production

#### Verification
- [ ] Verify rate limits are enforced
- [ ] Check Redis connection is stable
- [ ] Monitor 429 response rates
- [ ] Verify no false positives
- [ ] Check performance impact

#### Monitoring
- [ ] Monitor Redis CPU and memory
- [ ] Track rate limit hit patterns
- [ ] Identify potential attackers
- [ ] Review and adjust limits if needed

## Testing Commands

### Local Testing

```bash
# Start Redis
docker run -d -p 6379:6379 redis:alpine

# Verify Redis
redis-cli ping

# Start application
npm run start:dev

# Test global limit (should get 429 on 101st request)
for i in {1..101}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api
done

# Test auth endpoint limit (should get 429 on 11th request)
for i in {1..11}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n"
done

# Test health check (all should succeed)
for i in {1..200}; do
  curl -s http://localhost:3000/health
done

# Check rate limit headers
curl -i http://localhost:3000/api | grep -i ratelimit

# Run tests
npm test -- test/rate-limiting.spec.ts
```

### Staging Testing

```bash
# Replace with your staging URL
STAGING_URL="https://staging.yourdomain.com"

# Test rate limits
for i in {1..101}; do
  curl -s -o /dev/null -w "%{http_code}\n" $STAGING_URL/api
done

# Check headers
curl -i $STAGING_URL/api | grep -i ratelimit
```

### Production Testing

```bash
# Replace with your production URL
PROD_URL="https://yourdomain.com"

# Test a few requests (don't overload production!)
for i in {1..5}; do
  curl -i $PROD_URL/api | grep -i ratelimit
done
```

## Expected Behavior

### Normal Request (Within Limit)

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1677649200
Content-Type: application/json
```

### Rate Limited Request (429)

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

## Troubleshooting

### Issue: Rate limits not working

**Checklist:**
- [ ] Redis is running: `redis-cli ping`
- [ ] Environment variables are set
- [ ] Application logs show Redis connection
- [ ] Guard is registered globally in AppModule
- [ ] No errors in application logs

### Issue: All requests getting 429

**Checklist:**
- [ ] Check Redis keys: `redis-cli KEYS throttle:*`
- [ ] Verify IP extraction is correct
- [ ] Check for shared IP (proxy/NAT)
- [ ] Clear Redis: `redis-cli FLUSHDB` (dev only!)
- [ ] Review rate limit configuration

### Issue: Health check is rate limited

**Checklist:**
- [ ] Verify `@SkipThrottle()` decorator is applied
- [ ] Check route path matches exactly
- [ ] Review guard skip logic

### Issue: Redis connection errors

**Checklist:**
- [ ] Verify Redis host and port
- [ ] Check Redis password
- [ ] Test connection: `redis-cli -h HOST -p PORT -a PASSWORD ping`
- [ ] Check firewall rules
- [ ] Review application logs for connection errors

## Monitoring Checklist

### Metrics to Track
- [ ] Number of 429 responses per endpoint
- [ ] Top rate-limited IP addresses
- [ ] Rate limit hit patterns over time
- [ ] Redis memory usage
- [ ] Redis CPU usage
- [ ] Redis connection count
- [ ] Average response time impact

### Alerts to Set Up
- [ ] High rate of 429 responses (potential attack)
- [ ] Redis connection failures
- [ ] Redis memory usage > 80%
- [ ] Specific IP hitting limits repeatedly
- [ ] Unusual traffic patterns

## Performance Checklist

### Redis Performance
- [ ] Redis memory usage is acceptable
- [ ] Redis CPU usage is low
- [ ] No connection pool exhaustion
- [ ] TTL expiration working correctly
- [ ] No memory leaks

### Application Performance
- [ ] Response time impact is minimal
- [ ] No significant CPU increase
- [ ] Guard execution time is fast
- [ ] No blocking operations

## Security Checklist

- [ ] Rate limits protect against brute-force
- [ ] Auth endpoints have stricter limits
- [ ] Verify endpoints have strictest limits
- [ ] Health checks don't expose system info
- [ ] 429 responses don't leak sensitive data
- [ ] Rate limit violations are logged
- [ ] Monitoring alerts are configured

## Documentation Checklist

- [ ] Rate limiting documented in README
- [ ] API documentation updated with rate limits
- [ ] Environment variables documented
- [ ] Troubleshooting guide available
- [ ] Monitoring guide available
- [ ] Team trained on rate limiting system

## Sign-off

- [ ] Developer: Implementation complete
- [ ] Code Review: Approved
- [ ] QA: Tested in staging
- [ ] Security Review: Approved
- [ ] DevOps: Redis infrastructure ready
- [ ] Product Owner: Accepted

---

**Implementation Date:** [Date]  
**Deployed to Staging:** [Date]  
**Deployed to Production:** [Date]  
**Verified By:** [Name]  
**Redis Version:** [Version]
