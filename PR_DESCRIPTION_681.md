# IP Allowlist Enforcement Per Tenant

## Summary

Implements per-tenant IP allowlist enforcement so that a tenant can restrict API access to known IP addresses/CIDR ranges.

## Acceptance Criteria

### ✅ TenantConfig supports `ipAllowlist` field
- **File**: `src/tenant-config/constants/config-keys.constant.ts`
- Added `IP_ALLOWLIST: 'ip_allowlist'` to `SUPPORTED_CONFIG_KEYS`
- Default value is `[]` (empty array = no restriction)
- Config is stored as a JSON array of CIDR-range strings (e.g. `["10.0.0.0/8", "192.168.1.100"]`)

### ✅ Guard checks request IP against allowlist in middleware chain
- **File**: `src/tenant-config/guards/tenant-ip-allowlist.guard.ts`
- Global `APP_GUARD` registered in `app.module.ts` (runs on every request)
- Extracts tenant ID from request: headers → user JWT → query/URL params
- Fetches `ip_allowlist` config for the tenant via `TenantConfigService`
- CIDR matching supports both exact IPs and CIDR notation (e.g. `10.0.0.0/8`)
- Handles `x-forwarded-for` and `x-real-ip` headers for proxy environments
- Falls back to `req.ip` / `req.socket.remoteAddress`
- If no tenant ID present in request → skip check (allow)
- If allowlist is empty or not configured → skip check (allow by default)

### ✅ Returns 403 Forbidden on IP mismatch
- Throws `ForbiddenException('Access from this IP address is not allowed')`
- Logs a warning with the blocked IP and tenant ID

### ✅ Empty allowlist means no restriction (default)
- Default config value is an empty array `[]`
- Guard returns `true` immediately when allowlist is empty/null

### ✅ Admin endpoint to manage allowlist without redeployment
- No new endpoint needed — the existing `PATCH /admin/tenants/:id/config` API already supports managing config values
- Admin sets:
  ```json
  {
    "key": "ip_allowlist",
    "value": "[\"10.0.0.0/8\", \"192.168.1.100\"]",
    "valueType": "array"
  }
  ```
- Changes take effect immediately (config is read from DB/cache per request)
- Cache TTL is 600 seconds (10 minutes) with Redis, but cache is bypassed on miss

### ✅ Tests with allowlisted and non-allowlisted IPs
- **File**: `test/e2e/tenant-ip-allowlist.e2e-spec.ts`
- E2e tests with dedicated test controller guarded by `TenantIpAllowlistGuard`
- Tests cover:
  - Empty allowlist (default) → request allowed
  - No tenant ID → request allowed
  - CIDR-range IP `10.0.0.50` → allowed
  - Exact-match IP `192.168.1.100` → allowed
  - Non-allowlisted IP `1.2.3.4` → 403
  - Non-matching CIDR `172.16.0.1` → 403
  - `x-real-ip` header with allowed IP → allowed
  - `x-real-ip` header with blocked IP → 403

## Files Changed

| File | Change | Purpose |
|------|--------|---------|
| `src/tenant-config/constants/config-keys.constant.ts` | Modified | Added `IP_ALLOWLIST` key and default |
| `src/tenant-config/guards/tenant-ip-allowlist.guard.ts` | **New** | Per-tenant IP allowlist guard |
| `src/tenant-config/tenant-config.module.ts` | Modified | Registered and exported guard |
| `src/app.module.ts` | Modified | Registered guard as global APP_GUARD |
| `test/e2e/tenant-ip-allowlist.e2e-spec.ts` | **New** | E2E tests |

## How to Configure

### Via Admin API
```
PATCH /admin/tenants/{tenantId}/config
Content-Type: application/json

{
  "key": "ip_allowlist",
  "value": "[\"10.0.0.0/8\", \"192.168.1.0/24\", \"203.0.113.5\"]",
  "valueType": "array"
}
```

### To remove restriction (revert to allow all)
```
DELETE /admin/tenants/{tenantId}/config/ip_allowlist
```

## Architecture

The guard is registered as a global `APP_GUARD` in `app.module.ts`:
```typescript
{
  provide: APP_GUARD,
  useClass: TenantIpAllowlistGuard,
}
```

It runs on every request before route-specific guards. The execution flow:
1. Extract tenant ID from `x-tenant-id` header (or JWT claims)
2. Fetch `ip_allowlist` config for the tenant
3. If empty/null → allow
4. Extract client IP from headers (X-Forwarded-For → X-Real-IP → socket)
5. Check IP against allowlist CIDR entries
6. If no match → 403 Forbidden

Closes #681
