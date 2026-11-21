# Bull Board Authentication Security Fix

## Vulnerability Summary

The BullBoardAuthMiddleware had critical security flaws allowing:
- Cross-tenant PHI exposure through org-level admin impersonation
- Bypassing JWT secret rotation verification
- Ignoring revoked sessions
- Unprotected job manipulation in production

## Issues Fixed

### 1. Role-Based Access Control (RBAC) Bypass

**Before:**
```typescript
if (payload.role !== UserRole.ADMIN) {
  throw new ForbiddenException('Admin privileges required...');
}
```

**Problem:** Hospital admins could access all queues across all tenants, reading PHI-bearing payloads.

**After:**
```typescript
if (payload.role !== UserRole.SUPER_ADMIN) {
  throw new ForbiddenException('SUPER_ADMIN privileges required...');
}
```

**Impact:** Only system-level super admins can access Bull Board. Organization admins are blocked.

---

### 2. Secret Rotation Bypass

**Before:**
```typescript
const payload = this.jwtService.verify(token, {
  secret: this.configService.get<string>('JWT_SECRET'),
});
```

**Problem:**
- Hardcoded static `JWT_SECRET` without algorithm pinning
- Ignored `SecretRotationService` which manages active + retired secrets
- Tokens signed with rotated secrets would be rejected

**After:**
```typescript
const payload = this.authTokenService.verifyAccessToken(token);
```

**Impact:** 
- Tokens are verified via `SecretRotationService.verify()` which tries active + recently-rotated secrets
- Algorithm enforcement (HS512) is applied
- Supports zero-downtime secret rotation

---

### 3. Session Revocation Check Missing

**Before:** No session validation. Once a token was issued, it remained valid indefinitely (until JWT expiry).

**After:**
```typescript
const sessionValid = await this.sessionManagementService.isSessionValid(payload.sessionId);
if (!sessionValid) {
  throw new UnauthorizedException('Session has been revoked or expired');
}
```

**Impact:**
- Revoked sessions are immediately blocked
- Supports forced logout and device management
- HIPAA compliance (15-minute inactivity timeout enforcement)

---

### 4. Production Protection

**Before:** No differentiation between development and production environments.

**After:**
```typescript
if (this.isProduction) {
  res.setHeader('X-Bull-Board-Mode', 'read-only');
  this.logger.warn(`Bull Board accessed in production (read-only mode)...`);
}
```

**Impact:**
- Production Bull Board access is logged with severity
- Read-only mode header signals downstream UI/APIs to prevent mutations
- Prevents accidental job retries/deletions in production

---

## Compliance Impact

### HIPAA (Health Insurance Portability and Accountability Act)
- ✅ Prevents unauthorized PHI access
- ✅ Enforces session revocation
- ✅ Improves audit trail (session IDs, timestamps, IP addresses)

### Multi-Tenancy Security
- ✅ Blocks org-level admins from cross-tenant access
- ✅ Restricts job/queue visibility to super admins only

### GDPR (General Data Protection Regulation)
- ✅ Enforces least-privilege access
- ✅ Right to data erasure reflected in session revocation

---

## Implementation Details

### Dependencies Added to QueueModule
- `AuthModule` — provides `AuthTokenService` and `SessionManagementService`

### Middleware Dependencies
1. **AuthTokenService**
   - Uses `SecretRotationService.verify()` for token validation
   - Returns `JwtPayload` with `userId`, `role`, `sessionId`, etc.

2. **SessionManagementService**
   - Checks session `isActive` flag
   - Validates expiration time
   - Detects revocation

3. **ConfigService**
   - Reads `NODE_ENV` for production mode detection

### Logging & Audit Trail

| Event | Log Level | Details |
|-------|-----------|---------|
| Missing token | WARN | IP address, attempt timestamp |
| Token verification failed | WARN | IP address, reason |
| Insufficient role | WARN | User ID, role, IP address |
| Session invalid | WARN | User ID, session ID, IP address |
| Access granted | LOG | User ID, session ID, IP address |
| Production access | WARN | User ID, IP address (security alert) |
| Unexpected error | ERROR | Exception message, IP address |

---

## Testing

Unit tests in `bull-board-auth.middleware.spec.ts` verify:
- ✅ Missing/invalid token rejection
- ✅ Non-SUPER_ADMIN role rejection
- ✅ Session revocation enforcement
- ✅ Successful authentication flow
- ✅ Production read-only mode
- ✅ Secret rotation integration
- ✅ Client IP extraction

Run tests:
```bash
npm test -- bull-board-auth.middleware.spec.ts
```

---

## Migration Guide

No breaking changes for legitimate deployments:

1. **Identify current Bull Board users:**
   ```sql
   SELECT DISTINCT users.id, users.email, users.role 
   FROM sessions 
   JOIN users ON sessions.userId = users.id 
   WHERE sessions.createdAt > NOW() - INTERVAL 7 DAY;
   ```

2. **Audit org admin access to Bull Board:**
   - Check logs for `/admin/queues` requests from non-SUPER_ADMIN users
   - Identify compromised sessions

3. **Promote system admins to SUPER_ADMIN role (if needed):**
   - Only if they legitimately need Bull Board access
   - Document the reason in audit logs

4. **Deploy the fix:**
   - No database migration required
   - Existing sessions remain valid
   - Only Bull Board access is restricted

5. **Monitor for access denials:**
   - Log level will increase for Bull Board attempts
   - These are expected from demoted users

---

## Post-Deployment Verification

### Verify Org Admin Rejection
```bash
# Try accessing Bull Board as org admin (should fail)
curl -H "Authorization: Bearer <org-admin-token>" \
  https://api.example.com/admin/queues

# Expected: 403 Forbidden - SUPER_ADMIN privileges required
```

### Verify SUPER_ADMIN Access
```bash
# Try accessing Bull Board as super admin (should succeed)
curl -H "Authorization: Bearer <super-admin-token>" \
  https://api.example.com/admin/queues

# Expected: 200 OK - Bull Board UI loads
```

### Verify Session Revocation Works
```bash
# Revoke a session
POST /auth/sessions/{sessionId}/revoke

# Try accessing Bull Board with that session (should fail)
curl -H "Authorization: Bearer <revoked-session-token>" \
  https://api.example.com/admin/queues

# Expected: 401 Unauthorized - Session has been revoked
```

### Verify Production Read-Only Mode
```bash
# Check response headers in production
curl -I -H "Authorization: Bearer <token>" \
  https://api.prod.example.com/admin/queues

# Expected: X-Bull-Board-Mode: read-only
```

---

## References

- **HIPAA Audit & Accountability Rule:** 45 CFR § 164.312(b)
- **GDPR Data Access Rights:** Article 15-18
- **OWASP Authentication Cheat Sheet:** https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- **NestJS Security Best Practices:** https://docs.nestjs.com/security/authentication
