# Security Headers - Quick Start Guide

## What Was Implemented

✅ Helmet middleware configured in `src/main.ts`  
✅ Content-Security-Policy with strict directives  
✅ X-Frame-Options: DENY  
✅ X-Content-Type-Options: nosniff  
✅ Strict-Transport-Security (HSTS)  
✅ Referrer-Policy: strict-origin-when-cross-origin  
✅ X-Powered-By header removed  
✅ CORS configured with explicit origin whitelist  

## Quick Verification

### 1. Start the Application

```bash
npm run start:dev
```

### 2. Test with curl

```bash
curl -I http://localhost:3000/api
```

Expected headers:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
```

Should NOT see:
```
X-Powered-By: Express
```

### 3. Run Security Tests

```bash
npm test -- test/security-headers.spec.ts
```

### 4. Verify with nmap (Optional)

```bash
nmap --script http-security-headers -p 3000 localhost
```

Or use the provided script:
```bash
./scripts/verify-security-headers.sh localhost 3000
```

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
CORS_CREDENTIALS=true
```

### Production Setup

For production, update CORS origins:

```env
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
CORS_CREDENTIALS=true
```

## Testing Checklist

- [ ] Application starts without errors
- [ ] All security headers present in response
- [ ] X-Powered-By header is removed
- [ ] CORS works for allowed origins
- [ ] CORS blocks unauthorized origins
- [ ] Swagger UI loads correctly
- [ ] CSP doesn't block legitimate resources
- [ ] Tests pass: `npm test -- test/security-headers.spec.ts`

## Common Issues

### Issue: Swagger UI not loading styles

**Solution:** CSP already allows `unsafe-inline` for styles. Check browser console for specific errors.

### Issue: CORS errors in browser

**Solution:** Add your frontend origin to `CORS_ALLOWED_ORIGINS` in `.env`

### Issue: CSP blocking resources

**Solution:** Review browser console CSP violations and adjust directives in `src/main.ts` if needed (but avoid `unsafe-inline` for scripts)

## Next Steps

1. Deploy to staging/production
2. Verify headers in production environment
3. Monitor for CSP violations
4. Set up security header monitoring/alerts
5. Consider adding CSP reporting endpoint

## Documentation

- Full documentation: `docs/SECURITY_HEADERS.md`
- Verification script: `scripts/verify-security-headers.sh`
- Tests: `test/security-headers.spec.ts`
