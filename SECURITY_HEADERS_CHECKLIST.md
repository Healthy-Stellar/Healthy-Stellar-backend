# Security Headers Implementation Checklist

## Pre-Deployment Checklist

### Code Implementation ✅
- [x] Helmet installed (v8.1.0)
- [x] Helmet configured in `src/main.ts`
- [x] Content-Security-Policy configured
- [x] X-Frame-Options set to DENY
- [x] X-Content-Type-Options set to nosniff
- [x] Strict-Transport-Security configured (1 year, includeSubDomains, preload)
- [x] Referrer-Policy configured
- [x] X-Powered-By header removed
- [x] CORS configured with explicit origin whitelist
- [x] CSP has NO unsafe-inline for scripts
- [x] CSP has NO unsafe-eval

### Testing ✅
- [x] Verification script created (`scripts/verify-security-headers.sh`)
- [x] Test suite created (`test/security-headers.spec.ts`)
- [x] Documentation created (`docs/SECURITY_HEADERS.md`)
- [x] Quick start guide created (`docs/SECURITY_HEADERS_QUICK_START.md`)

### Configuration ✅
- [x] `.env.example` updated with CORS_ALLOWED_ORIGINS
- [x] Default CORS origins set for development
- [x] Environment variable parsing implemented

## Deployment Checklist

### Before Deployment
- [ ] Update `.env` with production CORS origins
- [ ] Verify HTTPS is enabled in production
- [ ] Test application starts without errors
- [ ] Run test suite: `npm test -- test/security-headers.spec.ts`
- [ ] Verify Swagger UI loads correctly

### After Deployment to Staging
- [ ] Run verification script against staging
- [ ] Test CORS from allowed origins
- [ ] Test CORS blocks unauthorized origins
- [ ] Verify all security headers present
- [ ] Check browser console for CSP violations
- [ ] Test API functionality with security headers

### After Deployment to Production
- [ ] Run verification script against production
- [ ] Verify HTTPS redirect works
- [ ] Verify HSTS header present
- [ ] Test CORS from production frontend
- [ ] Monitor logs for CSP violations
- [ ] Document any CSP adjustments needed

## Verification Commands

### Local Testing
```bash
# Start application
npm run start:dev

# Test with curl
curl -I http://localhost:3000/api

# Run verification script
./scripts/verify-security-headers.sh localhost 3000

# Run tests
npm test -- test/security-headers.spec.ts

# Verify with nmap (if installed)
nmap --script http-security-headers -p 3000 localhost
```

### Staging Testing
```bash
# Replace with your staging URL
curl -I https://staging.yourdomain.com/api

./scripts/verify-security-headers.sh staging.yourdomain.com 443

nmap --script http-security-headers -p 443 staging.yourdomain.com
```

### Production Testing
```bash
# Replace with your production URL
curl -I https://yourdomain.com/api

./scripts/verify-security-headers.sh yourdomain.com 443

nmap --script http-security-headers -p 443 yourdomain.com
```

## Expected Headers

When you run `curl -I http://localhost:3000/api`, you should see:

```
HTTP/1.1 200 OK
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none'
Referrer-Policy: strict-origin-when-cross-origin
```

You should NOT see:
```
X-Powered-By: Express
```

## Troubleshooting

### Issue: Headers not appearing
- Check Helmet is imported and configured before routes
- Verify application is using the updated `main.ts`
- Restart the application

### Issue: CORS errors
- Verify origin is in `CORS_ALLOWED_ORIGINS`
- Check environment variable is loaded
- Verify no trailing slashes in origins

### Issue: Swagger UI not loading
- CSP already allows `unsafe-inline` for styles
- Check browser console for specific errors
- Verify `crossOriginEmbedderPolicy: false` is set

### Issue: CSP blocking resources
- Review browser console for violation details
- Adjust CSP directives if needed (avoid unsafe-inline for scripts)
- Consider using CSP report-only mode for testing

## Monitoring

Set up monitoring for:
- [ ] Security header presence
- [ ] CSP violation reports
- [ ] CORS errors in logs
- [ ] Failed authentication attempts
- [ ] Unusual traffic patterns

## Documentation

- Implementation summary: `SECURITY_HEADERS_IMPLEMENTATION.md`
- Full documentation: `docs/SECURITY_HEADERS.md`
- Quick start: `docs/SECURITY_HEADERS_QUICK_START.md`
- This checklist: `SECURITY_HEADERS_CHECKLIST.md`

## Sign-off

- [ ] Developer: Implementation complete
- [ ] Code Review: Approved
- [ ] QA: Tested in staging
- [ ] Security Review: Approved
- [ ] DevOps: Deployed to production
- [ ] Product Owner: Accepted

---

**Implementation Date:** [Date]  
**Deployed to Staging:** [Date]  
**Deployed to Production:** [Date]  
**Verified By:** [Name]
