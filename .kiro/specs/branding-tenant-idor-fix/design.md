# Branding IDOR Bugfix Design

## Overview

The branding endpoints (`PUT /admin/tenants/:id/branding` and `GET /:id/branding`) currently allow admins to read and modify any tenant's branding configuration without tenant-ownership validation. This creates an Insecure Direct Object Reference (IDOR) vulnerability enabling cross-tenant access.

The fix applies the same tenant-ownership validation pattern used by TenantConfigController to branding endpoints, enforcing that only super admins can access other tenants' branding. This is a defense-in-depth fix applied at both controller and service layers.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a non-super-admin user attempts to read or modify a tenant's branding where the tenant ID differs from the user's own tenant ID
- **Property (P)**: The desired behavior when the bug condition exists - the system SHALL deny access with 403 Forbidden
- **Preservation**: Existing behavior that must remain unchanged - legitimate access to own tenant's branding, super admin access to any tenant's branding, authentication/authorization for non-admins
- **validateTenantAccess**: A private method in TenantConfigController that implements organization-level isolation and super-admin bypass logic
- **isBugCondition**: The function that identifies inputs where the bug manifests - when tenantId in URL differs from user's tenantId and user is not super admin
- **BrandingConfig**: The data structure containing logo URL, colors, support email/phone, and custom domain for a tenant

## Bug Details

### Bug Condition

The bug manifests when a non-super-admin user attempts to call PUT or GET branding endpoints for a tenant that does not match their own tenant ID. The branding endpoints lack the tenant-ownership validation that exists in TenantConfigController, creating an IDOR gap where any admin can access any tenant's branding.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type BrandingRequest
  OUTPUT: boolean
  
  RETURN input.requestedTenantId != input.user.tenantId
         AND input.user.role != UserRole.SUPER_ADMIN
         AND input.method IN ['GET', 'PUT']
END FUNCTION
```

### Examples

**Example 1 - Cross-tenant PUT (Defective Behavior)**
- Admin from Tenant A with ID: `00000000-0000-0000-0000-000000000001`
- Calls: `PUT /admin/tenants/00000000-0000-0000-0000-000000000002/branding`
- With: `{ "logoUrl": "https://attacker.com/logo.png", "supportEmail": "attacker@phishing.com" }`
- Current behavior: Request succeeds, Tenant B's branding is modified
- Expected behavior: Request fails with 403 Forbidden

**Example 2 - Cross-tenant GET (Defective Behavior)**
- Admin from Tenant A with ID: `00000000-0000-0000-0000-000000000001`
- Calls: `GET /00000000-0000-0000-0000-000000000002/branding`
- Current behavior: Returns Tenant B's complete branding config including support contacts
- Expected behavior: Request fails with 403 Forbidden

**Example 3 - Own Tenant Access (Should Work)**
- Admin from Tenant A with ID: `00000000-0000-0000-0000-000000000001`
- Calls: `GET /00000000-0000-0000-0000-000000000001/branding`
- Expected behavior: Request succeeds, returns Tenant A's branding config
- This behavior must be preserved

**Example 4 - Super Admin Cross-tenant Access (Should Work)**
- Super admin with ID: `00000000-0000-0000-0000-000000000099`
- Calls: `PUT /admin/tenants/00000000-0000-0000-0000-000000000002/branding`
- Expected behavior: Request succeeds, Tenant B's branding is modified
- Super admins have no tenant restrictions

**Example 5 - Edge Case: Out of Range Tenant ID**
- Admin from Tenant A with ID: `00000000-0000-0000-0000-000000000001`
- Calls: `GET /invalid-tenant-id/branding`
- Expected behavior: Request fails with 400 Bad Request (invalid UUID) or 403 Forbidden (tenant mismatch)
- Current behavior: May return 404 or fail with unclear error

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Admins of a tenant SHALL continue to successfully read their own tenant's branding configuration via `GET /:id/branding`
- Admins of a tenant SHALL continue to successfully modify their own tenant's branding configuration via `PUT /admin/tenants/:id/branding`
- Super admins SHALL continue to be able to read and modify any tenant's branding without restriction
- Non-admin users SHALL continue to be denied access with 401 Unauthorized or 403 Forbidden
- Unauthenticated users SHALL continue to be denied access with 401 Unauthorized

**Scope:**
All inputs where the user is accessing their own tenant's branding (tenantId matches user.tenantId) should be completely unaffected by this fix. This includes:
- All GET operations for own tenant branding
- All PUT operations for own tenant branding
- All DELETE operations for own tenant branding (if applicable)
- Super admin operations on any tenant branding

## Hypothesized Root Cause

Based on the requirements, the most likely issues are:

1. **Missing validateTenantAccess() Calls**: The branding controller endpoints do not call the `validateTenantAccess()` method from TenantConfigController, unlike the config endpoints which properly validate tenant ownership

2. **No Service Layer Validation**: Even if controller-level validation is added, the service layer lacks tenant ownership checks, creating a defense-in-depth gap

3. **Inconsistent Access Control Pattern**: Different controllers use different validation approaches, creating opportunities for IDOR vulnerabilities in less-scrutinized controllers like branding

4. **Missing Role-based Bypass Logic**: The branding endpoints likely do not implement the super-admin exception that allows super admins to access any tenant's data

## Correctness Properties

Property 1: Bug Condition - Cross-tenant Branding Access Prevention

_For any_ HTTP request where the bug condition holds (isBugCondition returns true), the fixed branding endpoints SHALL deny the request with a 403 Forbidden HTTP response and SHALL NOT return or modify the requested tenant's branding configuration.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Own Tenant and Super Admin Access

_For any_ HTTP request where the bug condition does NOT hold (isBugCondition returns false), the fixed branding endpoints SHALL produce exactly the same response as before the fix, preserving all existing functionality for legitimate own-tenant and super-admin access.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/tenant/controllers/tenant.controller.ts` (or branding-specific controller if it exists)

**Function**: Branding endpoints (GET `/:id/branding`, PUT `/admin/tenants/:id/branding`)

**Specific Changes**:

1. **Extract and Share validateTenantAccess Logic**
   - Create a shared utility or injectable service `TenantAccessValidationService` that both TenantConfigController and branding controller can use
   - Move the `validateTenantAccess()` method to this shared location to eliminate code duplication
   - Implementation detail: Check if user.role === UserRole.SUPER_ADMIN, if not verify user.tenantId matches requestedTenantId

2. **Add Controller-level Validation**
   - Inject TenantAccessValidationService into branding controller
   - Call `validateTenantAccess(user, tenantId)` at the beginning of GET branding endpoint
   - Call `validateTenantAccess(user, tenantId)` at the beginning of PUT branding endpoint
   - Ensure validation occurs BEFORE any data is retrieved or modified

3. **Add Service-layer Validation (Defense-in-Depth)**
   - Add tenant ownership check in branding service methods (getBrandingForTenant, updateBranding)
   - Service layer validation provides protection if controller layer is bypassed
   - Throw ForbiddenException if tenant access validation fails at service layer

4. **Improve Error Messages and Logging**
   - Return generic 403 Forbidden error to prevent information disclosure
   - Log IDOR attempt warnings for security monitoring
   - Include sanitized tenant IDs in logs (prevent log injection)

5. **Add ParseUUIDPipe to Route Parameters**
   - Validate tenantId parameter format is valid UUID using NestJS ParseUUIDPipe
   - Return 400 Bad Request for malformed UUIDs before reaching business logic

6. **Standardize Response Format**
   - Ensure branding endpoints follow the same response format as TenantConfigController for consistency

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the IDOR vulnerability BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write e2e tests that simulate cross-tenant branding access from Admin A attempting to access Tenant B's branding. Run these tests on the UNFIXED code to observe the vulnerability and confirm it exists.

**Test Cases**:
1. **Cross-tenant GET Branding (Will Fail on Unfixed)**: Admin from Tenant A calls GET to retrieve Tenant B's branding - should fail but currently returns data
2. **Cross-tenant PUT Branding (Will Fail on Unfixed)**: Admin from Tenant A calls PUT to modify Tenant B's branding - should fail but currently succeeds
3. **Different Tenant ID Format (Will Fail on Unfixed)**: Non-matching UUID formats for cross-tenant access - should fail but currently returns data
4. **Out of Range Tenant (Will Fail on Unfixed)**: Admin attempts access to non-existent tenant ID - should fail with IDOR check but may return 404

**Expected Counterexamples**:
- Cross-tenant GET requests return 200 with Tenant B's branding data instead of 403
- Cross-tenant PUT requests return 200/204 with success instead of 403
- No tenant ownership validation occurs before data access

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed branding endpoints return 403 Forbidden and do not expose/modify cross-tenant data.

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  response := fixedBrandingEndpoint(request)
  ASSERT response.statusCode == 403
  ASSERT response.body != cross_tenant_branding_data
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed endpoints produce identical results to the original function.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT original_endpoint(request) == fixed_endpoint(request)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (own-tenant, super-admin)
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all legitimate access patterns

**Test Plan**: 
1. Observe behavior on UNFIXED code for own-tenant access to confirm it works
2. Observe behavior on UNFIXED code for super-admin cross-tenant access to confirm it works
3. Write property-based tests capturing these behaviors
4. Verify fixed code produces identical results

**Test Cases**:
1. **Own Tenant Access Preservation**: Verify admin accessing own tenant's branding continues to work after fix
2. **Super Admin Cross-tenant Access Preservation**: Verify super admin can still access any tenant's branding after fix
3. **Branding Data Integrity**: Verify branding configuration values (logo, colors, support info) are correctly stored and retrieved
4. **Multiple Tenant Isolation**: Generate random tenant/user combinations and verify isolation is maintained

### Unit Tests

- Test validateTenantAccess utility function with various user roles and tenant combinations
- Test tenant ID validation (UUID format checking)
- Test that ForbiddenException is thrown when tenant access is denied
- Test that error messages don't leak information about other tenants' existence

### Property-Based Tests

- Generate random combinations of: requesting user tenant ID, requested branding tenant ID, user role
- Verify: 403 returned when IDs don't match and user is not super admin
- Generate random branding configuration data and verify it's correctly persisted and retrieved for own tenant
- Test that modifying one tenant's branding doesn't affect others

### Integration Tests (e2e)

- Test full flow: Admin logs in, attempts cross-tenant branding access, receives 403
- Test full flow: Admin logs in, accesses own tenant branding, succeeds
- Test full flow: Super admin logs in, accesses arbitrary tenant branding, succeeds
- Test switching between tenant contexts and ensuring isolation is maintained
- Test error scenarios: malformed UUID, non-existent tenant, invalid branding data
