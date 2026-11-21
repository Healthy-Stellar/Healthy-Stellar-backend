# Branding IDOR Bugfix - Implementation Tasks

## Overview

This task list implements the Branding IDOR fix using the exploratory bugfix workflow. Tasks are ordered to explore the bug, verify preservation of existing behavior, implement the fix, and validate the solution.

---

## Phase 1: Explore and Understand the Bug

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Cross-tenant Branding Access IDOR
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the IDOR vulnerability exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: cross-tenant access from Admin A to Tenant B's branding
  - Test implementation details from Bug Condition in design:
    - Admin from Tenant `00000000-0000-0000-0000-000000000001` calls PUT `/:id/branding` with Tenant B ID `00000000-0000-0000-0000-000000000002`
    - Admin from Tenant `00000000-0000-0000-0000-000000000001` calls GET `/:id/branding` with Tenant B ID `00000000-0000-0000-0000-000000000002`
    - Both requests should be denied with 403 Forbidden per Expected Behavior
  - The test assertions should match the Expected Behavior Properties from design (2.1, 2.2)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the IDOR bug exists)
  - Document counterexamples found to understand root cause (e.g., "Cross-tenant GET returns 200 with branding data instead of 403")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2_

---

## Phase 2: Verify Preservation of Existing Behavior

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Own Tenant and Super Admin Branding Access
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Admin accessing own tenant branding - should work
    - Super admin accessing any tenant branding - should work
    - Non-admin users accessing branding - should be denied
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements (3.1, 3.2, 3.3, 3.4)
  - Property-based testing generates many test cases for stronger guarantees across:
    - Own-tenant access with various tenant IDs
    - Super admin access across multiple tenants
    - Authentication/authorization scenarios
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

---

## Phase 3: Implement the Fix

- [ ] 3. Implement Branding IDOR Fix

  - [ ] 3.1 Extract validateTenantAccess shared utility
    - Create `src/common/services/tenant-access-validation.service.ts`
    - Extract the `validateTenantAccess()` logic from `TenantConfigController.validateTenantAccess()`
    - Implement organization-level isolation: Check if user's tenantId matches requested tenantId
    - Implement super-admin bypass: Allow UserRole.SUPER_ADMIN to bypass tenant checks
    - Throw ForbiddenException with generic message when access is denied
    - Log IDOR attempt warnings with sanitized tenant IDs (prevent log injection)
    - Implementation should follow the isBugCondition pseudocode from design:
      ```
      if user.role == UserRole.SUPER_ADMIN: allow access
      if user.tenantId == requestedTenantId: allow access
      else: deny with ForbiddenException
      ```
    - _Bug_Condition: isBugCondition(input) where input.tenantId != input.user.tenantId AND input.user.role != SUPER_ADMIN_
    - _Expected_Behavior: Deny cross-tenant access with 403 Forbidden from design_
    - _Preservation: Allow own-tenant and super-admin access from design_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [ ] 3.2 Add controller-layer validation to branding endpoints
    - Locate branding controller: `src/tenant/controllers/tenant.controller.ts` (or branding-specific controller)
    - Inject TenantAccessValidationService into branding controller constructor
    - Add ParseUUIDPipe to tenantId parameter in GET `/:id/branding` endpoint
    - Add ParseUUIDPipe to tenantId parameter in PUT `/admin/tenants/:id/branding` endpoint
    - In GET branding endpoint: Call validateTenantAccess(user, tenantId) BEFORE retrieving branding data
    - In PUT branding endpoint: Call validateTenantAccess(user, tenantId) BEFORE modifying branding data
    - Ensure validation occurs at the start of each endpoint handler
    - Return generic error messages (no tenant information disclosure)
    - Sanitize tenant IDs in logs (prevent log injection)
    - _Bug_Condition: Cross-tenant branding access attempts_
    - _Expected_Behavior: Controller validates tenant access and denies cross-tenant requests with 403_
    - _Preservation: Own-tenant and super-admin requests pass validation and proceed to service layer_
    - _Requirements: 2.1, 2.2_

  - [ ] 3.3 Add service-layer validation (defense-in-depth)
    - Locate branding service: `src/tenant/services/tenant.service.ts` (or branding-specific service)
    - Add tenant ownership check in getBrandingForTenant() method before returning data
    - Add tenant ownership check in updateBranding() method before persisting changes
    - Service layer should validate: if accessing_user.tenantId != brand.tenantId AND accessing_user.role != SUPER_ADMIN, throw ForbiddenException
    - This provides protection if controller layer validation is somehow bypassed
    - Throw consistent ForbiddenException with generic message
    - _Bug_Condition: Cross-tenant branding access bypassing controller validation_
    - _Expected_Behavior: Service layer validates and denies with 403 Forbidden_
    - _Preservation: Own-tenant and super-admin requests pass validation_
    - _Requirements: 2.1, 2.2_

  - [ ] 3.4 Improve error handling and logging
    - Update branding controller endpoints to use generic error messages (prevent information disclosure)
    - Do not include tenant IDs in error response bodies
    - Log IDOR attempt warnings with sanitized tenant IDs (prevent log injection)
    - Use consistent error message format: "Access denied to this tenant" (matching TenantConfigController)
    - Include details in logs: operation type, user ID, attempted tenant ID (all sanitized)
    - _Bug_Condition: Information disclosure through error messages_
    - _Expected_Behavior: Generic 403 responses with no tenant information_
    - _Preservation: Legitimate access errors (404 for missing branding) remain unchanged_
    - _Requirements: 2.1, 2.2_

  - [ ] 3.5 Add UUID validation to route parameters
    - Verify ParseUUIDPipe is applied to tenantId parameter in all branding endpoints
    - ParseUUIDPipe validates UUID format and returns 400 Bad Request for malformed UUIDs
    - This prevents invalid UUIDs from reaching business logic
    - Update GET `/:id/branding` route parameter: `@Param('id', ParseUUIDPipe) tenantId: string`
    - Update PUT `/admin/tenants/:id/branding` route parameter: `@Param('id', ParseUUIDPipe) tenantId: string`
    - _Bug_Condition: Malformed UUIDs bypassing validation_
    - _Expected_Behavior: ParseUUIDPipe validates and returns 400 for invalid UUIDs_
    - _Requirements: 2.1, 2.2_

---

## Phase 4: Validate the Fix

- [ ] 4. Verify bug condition exploration test now passes
  - **Property 1: Expected Behavior** - Cross-tenant Branding Access Prevention
  - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
  - The test from task 1 encodes the expected behavior
  - When this test passes, it confirms the expected behavior is satisfied and the bug is fixed
  - Re-run bug condition exploration test from step 1
  - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
  - Verify all cross-tenant access attempts now return 403 Forbidden
  - Verify no branding data is returned or modified for cross-tenant requests
  - Document confirmation that bug is resolved
  - _Requirements: 2.1, 2.2_

- [ ] 5. Verify preservation tests still pass
  - **Property 2: Preservation** - Own Tenant and Super Admin Access Unchanged
  - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
  - Run preservation property tests from step 2
  - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
  - Verify admin accessing own tenant branding still works
  - Verify super admin accessing any tenant branding still works
  - Verify non-admin users still denied access
  - Verify branding data integrity (values stored and retrieved correctly)
  - Mark task complete when all preservation tests pass
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

---

## Phase 5: Final Checkpoint

- [ ] 6. Checkpoint - Ensure all tests pass and fix is complete
  - Run full test suite for branding endpoints
  - Verify bug condition tests pass (cross-tenant access denied)
  - Verify preservation tests pass (own-tenant and super-admin access works)
  - Verify no new test failures introduced
  - Verify error messages are generic and don't leak tenant information
  - Verify logs are sanitized and don't contain CRLF injection vulnerabilities
  - Verify ParseUUIDPipe validates tenant IDs in all branding endpoints
  - Confirm TenantAccessValidationService is used consistently
  - Ask user if questions arise or if additional testing is needed
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_
