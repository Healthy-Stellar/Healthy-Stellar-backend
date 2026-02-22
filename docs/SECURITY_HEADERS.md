# Security Headers Implementation

This document describes the security headers configuration implemented to protect against common HTTP vulnerabilities.

## Overview

The application uses [Helmet](https://helmetjs.github.io/) middleware to set secure HTTP headers that help protect against:
- Cross-Site Scripting (XSS)
- Clickjacking
- MIME type sniffing
- Man-in-the-middle attacks
- Information disclosure

## Implemented Headers

### 1. Content-Security-Policy (CSP)

Prevents XSS attacks by controlling which resources can be loaded.

```
Content-Security-Policy: 
  default-src 'self';
  style-src 'self' 'unsafe-inline';
  script-src 'self';
  img-src 'self' data: https:;
  connect-src 'self';
  font-src 'self';
  object-src 'none';
  media-src 'self';
  frame-src 'none'
```

**Key Points:**
- No `unsafe-inline` or `unsafe-eval` for scripts (prevents inline script execution)
- `style-src` allows `unsafe-inline` only for Swagger UI compatibility
- `object-src` and `frame-src` set to `none` for maximum protection

### 2. X-Frame-Options: DENY

Prevents clickjacking attacks by disallowing the page to be embedded in frames.

```
X-Frame-Options: DENY
```

### 3. X-Content-Type-Options: nosniff

Prevents MIME type sniffing, forcing browsers to respect declared content types.

```
X-Content-Type-Options: nosniff
```

### 4. Strict-Transport-Security (HSTS)

Forces HTTPS connections and prevents protocol downgrade attacks.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Configuration:**
- `max-age=31536000`: 1 year duration
- `includeSubDomains`: Applies to all subdomains
- `preload`: Eligible for browser HSTS preload lists

### 5. Referrer-Policy

Controls how much referrer information is sent with requests.

```
Referrer-Policy: strict-origin-when-cross-origin
```

### 6. X-Powered-By Removal

The `X-Powered-By` header is explicitly removed to prevent information disclosure about the server technology.

## CORS Configuration

Cross-Origin Resource Sharing (CORS) is configured with explicit origin whitelisting:

```typescript
app.enableCors({
  origin: corsOrigins, // From CORS_ALLOWED_ORIGINS env variable
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 3600,
});
```

### Environment Configuration

Set allowed origins in `.env`:

```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://yourdomain.com
CORS_CREDENTIALS=true
```

## Verification

### Using the Verification Script

Run the provided script to verify all security headers:

```bash
# Make script executable (Linux/Mac)
chmod +x scripts/verify-security-headers.sh

# Run verification
./scripts/verify-security-headers.sh localhost 3000
```

### Using nmap

```bash
nmap --script http-security-headers -p 3000 localhost
```

### Using curl

```bash
curl -I http://localhost:3000/api
```

### Running Tests

```bash
npm test -- test/security-headers.spec.ts
```

## Production Considerations

### 1. HTTPS Only

In production, ensure:
- Application runs behind HTTPS
- HSTS header is active
- HTTP requests redirect to HTTPS

### 2. CSP Refinement

Review and adjust CSP directives based on your specific needs:
- Add trusted CDN domains if needed
- Monitor CSP violation reports
- Use `Content-Security-Policy-Report-Only` for testing

### 3. CORS Origins

- Never use `*` for CORS origins in production
- Maintain a strict whitelist of allowed origins
- Use environment variables for different environments

### 4. Regular Updates

- Keep Helmet updated: `npm update helmet`
- Review security advisories
- Test headers after updates

## Compliance

These security headers help meet various compliance requirements:

- **HIPAA**: Protects PHI from unauthorized access
- **PCI DSS**: Prevents common web vulnerabilities
- **OWASP Top 10**: Mitigates XSS, clickjacking, and other attacks
- **SOC 2**: Demonstrates security controls

## Troubleshooting

### Swagger UI Not Loading

If Swagger UI has issues:
- CSP allows `unsafe-inline` for styles (required)
- `crossOriginEmbedderPolicy` is disabled

### CORS Errors

If you see CORS errors:
1. Check `CORS_ALLOWED_ORIGINS` includes the requesting origin
2. Verify credentials setting matches your needs
3. Check allowed methods and headers

### CSP Violations

Monitor browser console for CSP violations:
1. Review the violation report
2. Adjust CSP directives if legitimate
3. Never use `unsafe-inline` or `unsafe-eval` for scripts

## References

- [Helmet Documentation](https://helmetjs.github.io/)
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Content Security Policy Reference](https://content-security-policy.com/)
