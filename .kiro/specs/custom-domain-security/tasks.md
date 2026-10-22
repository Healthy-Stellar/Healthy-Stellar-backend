# Custom Domain Security Implementation Tasks

## Phase 1: Exploration & Preservation Testing

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Custom Domain Request Resolution & Duplicate Prevention & DNS Verification
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to concrete failing case(s) to ensure reproducibility
  - Test implementation details from Bug Condition in design:
    1. Custom Domain Request: Tenant claims "hospital.com" with verified status, request with Host: hospital.com should resolve to that tenant
    2. Duplicate Prevention: Tenant A claims "hospital.com", Tenant B attempts same claim, should fail with unique constraint
    3. DNS Verification: Tenant claims "hospital.com", system should require DNS verification before domain is active
  - The test assertions should match the Expected Behavior Properties from design
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Header-Based & Subdomain-Based Resolution
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - X-Tenant-ID header requests resolve to specified tenant
    - Valid subdomain requests (e.g., "customer.app.com") resolve to tenant via subdomain extraction
    - Requests lacking both header and valid subdomain return BadRequestException("Tenant identifier not found")
    - Requests to inactive tenants return BadRequestException("Invalid or inactive tenant")
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - Property 4: Header-Based Resolution - X-Tenant-ID header continues working
    - Property 5: Subdomain-Based Resolution - subdomain extraction continues working
    - Property 6: Missing Identifier - missing header/subdomain continues raising error
    - Property 7: Inactive Tenant - inactive tenant continues raising error
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

## Phase 2: Implementation

- [ ] 3. Implement custom domain security fix

  - [ ] 3.1 Add custom_domain and verified_domain_status columns to Tenant entity
    - Add `custom_domain: string` column with unique constraint and nullable
    - Add `verified_domain_status: string` column with enum values ["unverified", "pending_verification", "verified", "failed"]
    - Create database migration to add both columns with proper indexes
    - Validate: schema changes compile without errors
    - _Bug_Condition: isBugCondition(input) where multiple tenants can claim same domain OR unverified domains resolve_
    - _Expected_Behavior: Custom domains uniquely owned, only verified domains active_
    - _Preservation: All existing tenant fields and behavior unchanged_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.2 Create DomainCacheService for O(1) domain→tenant lookup
    - Create `src/tenant/services/domain-cache.service.ts`
    - Implement in-memory Map<string, string> for domain→tenantId mapping
    - Load all verified domains (where verified_domain_status='verified') at application startup
    - Expose `getTenantIdByDomain(domain: string): string | null` for O(1) lookups
    - Expose `invalidateEntry(domain: string)` for cache invalidation
    - Listen for domain verification events to update cache automatically
    - Handle case-insensitive domain matching
    - Validate: service initializes and performs lookups correctly
    - _Bug_Condition: isBugCondition(input) where custom domain should resolve but no cached mapping exists_
    - _Expected_Behavior: Cache provides O(1) resolution for verified custom domains_
    - _Preservation: Non-custom-domain requests bypass cache_
    - _Requirements: 2.1_

  - [ ] 3.3 Create DomainVerificationService for DNS TXT record verification
    - Create `src/tenant/services/dns-verification.service.ts`
    - Implement method `generateChallenge(tenantId: string, domain: string): string` returning format `_healthystellar.{domain} TXT "tenant-id={tenantId}"`
    - Implement method `initiateVerification(tenantId: string, domain: string)` that updates verified_domain_status to "pending_verification"
    - Implement method `verifyDNSRecord(domain: string, tenantId: string): Promise<boolean>` that:
      - Queries DNS for TXT record at `_healthystellar.{domain}`
      - Validates record contains `tenant-id={tenantId}`
      - On success: updates database to verified_domain_status="verified", emits event
      - On failure: sets verified_domain_status="failed", returns false
    - Implement method `pollAndVerify(domain: string, tenantId: string, maxAttempts: number)` for async polling
    - Validate: DNS verification workflow executes correctly
    - _Bug_Condition: isBugCondition(input) where tenant claims domain without proving DNS ownership_
    - _Expected_Behavior: Domains only marked verified after successful DNS TXT record resolution_
    - _Preservation: Non-custom-domain requests unaffected_
    - _Requirements: 2.3_

  - [ ] 3.4 Create CustomDomainResolutionMiddleware
    - Create `src/tenant/middleware/custom-domain-resolution.middleware.ts`
    - Extract Host header from request
    - Query DomainCacheService for tenant ID
    - If found and verified: populate TenantContext with tenant data, populate schema name
    - If found but not verified: proceed to fallback (don't block)
    - If not found: pass to TenantInterceptor for subdomain/header fallback resolution
    - Ensure domain matching is case-insensitive
    - Register middleware in appropriate module to run BEFORE TenantInterceptor
    - Validate: middleware intercepts and resolves custom domain requests correctly
    - _Bug_Condition: isBugCondition(input) where Host header matches verified custom domain but no middleware resolves it_
    - _Expected_Behavior: Middleware resolves custom domain requests via cached mapping before falling back_
    - _Preservation: Subdomain and header-based requests continue through fallback path_
    - _Requirements: 2.1_

  - [ ] 3.5 Add domain claim and verification endpoints
    - Add POST `/tenants/{id}/domains/claim` endpoint to claim a custom domain
      - Input: { domain: string }
      - Validation: check domain format, check unique constraint, reject if already claimed by different tenant
      - Call DomainVerificationService.initiateVerification()
      - Return: { domain, status: "pending_verification", challenge: "..." }
    - Add POST `/tenants/{id}/domains/verify` endpoint to verify DNS and activate domain
      - Input: { domain: string }
      - Call DomainVerificationService.verifyDNSRecord()
      - On success: update status to "verified", emit cache invalidation event
      - Return: { domain, status: "verified" }
    - Add GET `/tenants/{id}/domains/status` endpoint to poll verification status
      - Return: { domain, status, lastAttempt }
    - Add DELETE `/tenants/{id}/domains/{domain}` endpoint to remove custom domain
      - Remove custom_domain, invalidate cache entry, return success
    - Validate: endpoints function correctly, unique constraints enforced
    - _Bug_Condition: isBugCondition(input) where duplicate domain claims succeed OR unverified domains become active_
    - _Expected_Behavior: Endpoints enforce unique constraint and DNS verification workflow_
    - _Preservation: Existing tenant endpoints continue unchanged_
    - _Requirements: 2.2, 2.3_

  - [ ] 3.6 Create database migration for new columns
    - Add `custom_domain VARCHAR UNIQUE NULLABLE` column to tenants table
    - Add `verified_domain_status VARCHAR DEFAULT 'unverified'` column to tenants table
    - Create index `idx_custom_domain` on custom_domain WHERE custom_domain IS NOT NULL
    - Validate: migration runs without errors, schema matches entity definition
    - _Requirements: 2.1, 2.2, 2.3_

## Phase 3: Verification

- [ ] 4. Verify bug condition exploration test now passes
  - **Property 1: Expected Behavior** - Custom Domain Request Resolution & Duplicate Prevention & DNS Verification
  - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
  - The test from task 1 encodes the expected behavior
  - When this test passes, it confirms the expected behavior is satisfied
  - Run bug condition exploration test from step 1
  - **EXPECTED OUTCOME**: Test PASSES (confirms all three bugs are fixed)
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 5. Verify preservation tests still pass
  - **Property 2: Preservation** - Header-Based & Subdomain-Based Resolution
  - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
  - Run preservation property tests from step 2
  - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions to existing behavior)
  - Confirm header resolution unchanged
  - Confirm subdomain extraction unchanged
  - Confirm missing identifier handling unchanged
  - Confirm inactive tenant handling unchanged
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 6. Checkpoint - All tests pass and fix is complete
  - Verify all tests from tasks 1, 2, 4, and 5 pass
  - Verify custom domain requests resolve correctly through full middleware chain
  - Verify schema isolation (SET search_path) applied for resolved custom domains
  - Verify cache invalidation on domain claim removal
  - Verify concurrent domain claim attempts are correctly handled
  - Ensure no regressions to existing header and subdomain resolution
  - Mark complete when all verifications pass
