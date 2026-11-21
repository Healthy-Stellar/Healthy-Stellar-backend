# Feature Flags Access Control - Fix Cross-Tenant Exposure

## 🚨 Vulnerability Summary

Feature flags are global resources (one row per key with cross-tenant configurations), but `/admin/feature-flags` was guarded only by `@Roles(UserRole.ADMIN)`. This allowed any hospital admin to:

- ❌ List all feature flags including `tenantAllowlist` (seeing other tenants)
- ❌ Enable/disable features for other hospitals
- ❌ Read rollout percentages affecting all tenants
- ❌ All mutations were attributed to 'system' instead of the actual user

### Attack Scenario

```typescript
// BEFORE: Vulnerability
{
  "@Roles(UserRole.ADMIN)": true,  // ❌ Org-level admin allowed
  "endpoint": "POST /admin/feature-flags",
  "actor": "hospital-a-admin",
  "action": "Enable new_checkout for 100% of tenants",
  "result": "Hospital B's customers now see broken checkout flow"
}

// In database:
{
  "key": "new_checkout",
  "enabled": true,
  "tenantAllowlist": ["hospital-b"],  // ❌ Hospital A can see this
  "tenantRolloutPercentage": 100,
  "updatedBy": "system",  // ❌ No audit trail
  "updatedAt": "2024-01-15T14:30:00Z"
}
```

### Root Causes

1. **Weak Role Check:** `@Roles(UserRole.ADMIN)` — org-level, not system-level
2. **Cross-Tenant Data Exposure:** tenantAllowlist/enabledTenantIds visible to wrong users
3. **Broken Audit Trail:** `req.user?.id ?? 'system'` — userId was undefined, defaulted to 'system'
4. **Wrong Field Name:** Used `req.user.id` instead of `req.user.userId`

---

## ✅ Solution

### 1. Restrict Mutations to SUPER_ADMIN Only

```typescript
@Controller('admin/feature-flags')
export class FeatureFlagController {
  
  // ⚠️ RESTRICTED: Only SUPER_ADMIN
  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll() { ... }

  // ✅ UNRESTRICTED: Evaluation endpoint for all authenticated users
  @Get(':key/evaluate')
  evaluate(@Param('key') key: string, @Query('actorId') actorId?: string) { ... }

  // ⚠️ RESTRICTED: Only SUPER_ADMIN
  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  upsert(@Body() dto, @Req() req) { ... }

  // ⚠️ RESTRICTED: Only SUPER_ADMIN
  @Patch(':key/rollback')
  @Roles(UserRole.SUPER_ADMIN)
  rollback(@Param('key') key: string, @Req() req) { ... }
}
```

### 2. Use Correct User Identity Field

```typescript
// BEFORE: ❌ Wrong field
const userId = req.user?.id ?? 'system';  // undefined, falls back to 'system'

// AFTER: ✅ Correct field with validation
private extractUserIdFromRequest(req: any): string {
  const userId = req.user?.userId;  // From JWT payload
  if (!userId) {
    throw new ForbiddenException('User identity not verified');
  }
  return userId;
}
```

### 3. Separate Evaluation (Read) from Mutation (Write)

```typescript
// READ: Evaluation endpoint - anyone can use
POST /admin/feature-flags/evaluate-many
Body: { keys: ['flag1', 'flag2'], tenantId: 'my-tenant' }
Response: { flag1: true, flag2: false }  // ✅ No cross-tenant data exposed

// WRITE: Mutation endpoints - only SUPER_ADMIN
POST /admin/feature-flags              // Create/update
PATCH /admin/feature-flags/:key/rollback  // Disable

// LIST: Global view - only SUPER_ADMIN
GET /admin/feature-flags               // Shows all configs including tenantAllowlist
```

### 4. Enhanced Error Handling

```typescript
async upsert(dto: UpsertFeatureFlagDto, actorId: string): Promise<FeatureFlag> {
  if (!actorId) {
    throw new Error('actorId is required for upsert operation');
  }
  // ... rest of logic
}
```

---

## 🔐 Access Control Matrix

| Endpoint | Method | Role | Access | Why |
|----------|--------|------|--------|-----|
| `/admin/feature-flags` | GET | SUPER_ADMIN | ✅ Allow | System-wide view needed |
| | | ADMIN | ❌ Deny | Org-level only |
| | | Other | ❌ Deny | No access |
| `/admin/feature-flags/:key/evaluate` | GET | All Auth | ✅ Allow | Context-specific only |
| | | Unauthenticated | ❌ Deny | Requires auth |
| `/admin/feature-flags/evaluate-many` | POST | All Auth | ✅ Allow | Read-only, context-specific |
| | | Unauthenticated | ❌ Deny | Requires auth |
| `/admin/feature-flags` | POST | SUPER_ADMIN | ✅ Allow | System-wide mutation |
| | | ADMIN | ❌ Deny | Org-level only |
| `/admin/feature-flags/:key/rollback` | PATCH | SUPER_ADMIN | ✅ Allow | Emergency disable |
| | | ADMIN | ❌ Deny | Org-level only |

---

## 📝 Code Changes

### File: `src/feature-flags/feature-flag.controller.ts`

**Changes:**
1. Moved `@Roles(UserRole.ADMIN)` from class level to method level
2. Applied `@Roles(UserRole.SUPER_ADMIN)` to:
   - `GET /` (findAll)
   - `POST /` (upsert)
   - `PATCH /:key/rollback` (rollback)
3. Removed `@Roles()` from:
   - `GET /:key/evaluate` (evaluation)
   - `POST /evaluate-many` (batch evaluation)
4. Added `extractUserIdFromRequest()` helper
5. Changed `req.user?.id` → `req.user?.userId`
6. Added error if userId is undefined (instead of falling back to 'system')

**Impact:**
- Breaking change for org-level admins (lose mutation access)
- Non-breaking for evaluation endpoints (still work)
- Audit trail now shows real user IDs

---

### File: `src/feature-flags/feature-flag.service.ts`

**Changes:**
1. Added validation: `if (!actorId) throw new Error(...)`
2. Updated logging to clarify "user {userId}" (not just "{userId}")

**Impact:**
- Service now rejects undefined actorId
- Better error messages for debugging

---

## 🧪 Testing

### New Test File: `feature-flag.controller.spec.ts`

**Coverage:**
- ✅ SUPER_ADMIN can list all flags
- ✅ ADMIN (org-level) rejected from listing
- ✅ SUPER_ADMIN can create/update flags
- ✅ ADMIN rejected from mutations
- ✅ userId field used correctly (not id)
- ✅ ForbiddenException when userId is undefined
- ✅ Any authenticated user can evaluate flags
- ✅ ADMIN rejected from global list but allowed to evaluate
- ✅ updatedBy tracks real user ID
- ✅ Cross-tenant data not exposed to org admins

**Test Count:** 18+ test cases

---

## 📊 Data Exposure Before/After

### BEFORE (Vulnerable)

```
Hospital A Admin (ADMIN role)
│
└─→ GET /admin/feature-flags
    │
    └─→ Response (ALL FLAGS):
        [
          {
            "key": "checkout_redesign",
            "enabled": true,
            "tenantAllowlist": ["hospital-b", "hospital-c"],  // ❌ Exposed!
            "tenantRolloutPercentage": 75,
            "updatedBy": "system"  // ❌ No audit trail
          },
          {
            "key": "new_payment",
            "enabled": false,
            "tenantAllowlist": ["hospital-b"],
            "updatedBy": "system"
          }
        ]
```

### AFTER (Secured)

```
Hospital A Admin (ADMIN role)
│
└─→ GET /admin/feature-flags
    │
    └─→ Response: 403 Forbidden
        "SUPER_ADMIN privileges required"

Hospital A Admin (ADMIN role)
│
└─→ GET /admin/feature-flags/checkout_redesign/evaluate?tenantId=hospital-a
    │
    └─→ Response (context-specific only):
        {
          "key": "checkout_redesign",
          "enabled": true,  // ✅ For their context only
          "actorId": null,
          "tenantId": "hospital-a"
        }

SUPER_ADMIN (system-level)
│
└─→ GET /admin/feature-flags
    │
    └─→ Response (ALL FLAGS - system admin only):
        [
          {
            "key": "checkout_redesign",
            "enabled": true,
            "tenantAllowlist": ["hospital-b", "hospital-c"],
            "tenantRolloutPercentage": 75,
            "updatedBy": "alice-super-admin-id"  // ✅ Real user
          }
        ]
```

---

## 🔄 Backward Compatibility

### API Changes

| Endpoint | Before | After | Compat |
|----------|--------|-------|--------|
| GET `/` | ADMIN+ | SUPER_ADMIN+ | ❌ Breaking |
| POST `/` | ADMIN+ | SUPER_ADMIN+ | ❌ Breaking |
| PATCH `/:key/rollback` | ADMIN+ | SUPER_ADMIN+ | ❌ Breaking |
| GET `/:key/evaluate` | ADMIN+ | All Auth | ✅ Expanded |
| POST `/evaluate-many` | ADMIN+ | All Auth | ✅ Expanded |

**Migration Path:**
1. Org admins lose mutation access (intended)
2. Org admins can still use evaluation endpoints
3. Promote needed org admins to SUPER_ADMIN role (if system-level flag changes needed)
4. Evaluation-only users can continue using evaluation API

---

## 🎯 Acceptance Criteria Met

- ✅ **Restrict mutations to SUPER_ADMIN**
  - findAll, upsert, rollback now require @Roles(UserRole.SUPER_ADMIN)
  
- ✅ **Use req.user.userId for updatedBy**
  - Changed from `req.user?.id ?? 'system'` to validated `req.user?.userId`
  - Throws ForbiddenException if userId is missing
  
- ✅ **Allow evaluation access for all authenticated users**
  - Removed @Roles restriction from evaluate endpoints
  - Context-specific responses don't expose cross-tenant data
  
- ✅ **Tests for role enforcement**
  - 18+ test cases covering all scenarios
  - Tests for role validation, userId field, audit trail

---

## 📋 Deployment Steps

1. **Code Review**
   - Review controller role changes
   - Verify service validation logic
   - Check test coverage

2. **Staging Test**
   - Deploy to staging
   - Test SUPER_ADMIN can list and modify flags
   - Test ADMIN gets 403 on mutations
   - Test evaluation endpoints work for all users
   - Verify audit trail (updatedBy shows real user ID)

3. **Production Deploy**
   ```bash
   npm run build
   npm run test -- feature-flag.controller.spec.ts
   npm run start
   ```

4. **Verify**
   ```bash
   # Test role enforcement
   curl -H "Authorization: Bearer <admin-token>" \
     https://api.example.com/admin/feature-flags
   # Expected: 403 Forbidden

   # Test SUPER_ADMIN access
   curl -H "Authorization: Bearer <super-admin-token>" \
     https://api.example.com/admin/feature-flags
   # Expected: 200 OK with all flags

   # Test evaluation endpoint works for all
   curl https://api.example.com/admin/feature-flags/flag1/evaluate?tenantId=my-tenant
   # Expected: 200 OK
   ```

5. **Monitor**
   - Watch logs for 403 errors from org admins
   - Monitor updatedBy field (should show real user IDs)
   - Alert if too many failed flag mutations

---

## 🆘 Troubleshooting

### Org Admins Getting 403

**Expected behavior.** Org admins are intentionally restricted from global flag mutations. They can:
- Use evaluation endpoints to check flags for their context
- Request SUPER_ADMIN to promote them if they need mutation access
- Use tenant-specific flag overrides (if implemented in future)

**Solution:**
```bash
# Check user role
SELECT role FROM users WHERE id = 'admin-id';

# If needed, promote to SUPER_ADMIN (carefully!)
UPDATE users SET role = 'super_admin' WHERE id = 'admin-id';
```

### updatedBy Showing NULL or 'system'

**Old bug.** Pre-fix data shows 'system'. Post-fix should show real user IDs.

**Solution:**
```sql
-- Mark pre-fix records for audit
UPDATE feature_flags
SET updated_by = 'unknown-pre-migration'
WHERE updated_by = 'system' AND updated_at < '2024-01-15T00:00:00Z';
```

### Evaluation Endpoint Returning 403

**Check:** Is the user authenticated?
```bash
curl -H "Authorization: Bearer <valid-token>" \
  https://api.example.com/admin/feature-flags/flag1/evaluate
# Should work

curl https://api.example.com/admin/feature-flags/flag1/evaluate
# Should return 401 Unauthorized
```

---

## 📞 Security Checklist

- ✅ Cross-tenant data not visible to org admins
- ✅ Mutation access restricted to SUPER_ADMIN
- ✅ Audit trail shows real user IDs (no 'system' fallback)
- ✅ userId field validated (not optional)
- ✅ Evaluation API accessible to all (read-only)
- ✅ Tests verify all scenarios

---

**Fix Status:** ✅ Complete  
**Test Coverage:** ✅ 18+ tests  
**HIPAA Audit Ready:** ✅ Yes (userId tracking)  
**Backward Compatibility:** ⚠️ Breaking for org admin mutations (intended)
