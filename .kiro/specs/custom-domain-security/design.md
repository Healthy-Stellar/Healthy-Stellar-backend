# Custom Domain Security Bugfix Design

## Overview

This design formalizes the security fix for custom domain resolution in the multi-tenant system. The bug prevents the documented Host→tenant resolution feature from working and creates security vulnerabilities (unauthorized domain claims, duplicate claims, DNS hijacking). The fix implements three core components: entity schema changes (add custom_domain and verified_domain_status columns with uniqueness constraints), domain→tenant resolution middleware with caching, and DNS TXT verification workflow. The approach follows the bug condition methodology to isolate buggy inputs (custom domain requests), define correct behavior (resolve to verified tenant), and preserve existing behavior (subdomain and header-based resolution continue unchanged).

## Glossary

- **Bug_Condition (C)**: A request with a Host header matching a custom domain that should resolve to a tenant, OR a tenant attempting to claim a custom domain
- **Property (P)**: For buggy inputs: resolve to the correct tenant via cached domain mapping; prevent duplicate claims; require DNS verification before activation
- **Preservation (¬C)**: Requests without custom domains (subdomain/header-based) must continue working exactly as before
- **DomainResolutionMiddleware**: New middleware component that intercepts requests and resolves custom domains to tenants using a cached mapping
- **DomainVerificationService**: Service that orchestrates DNS TXT record verification workflow and marks domains as verified
- **Host header**: HTTP Host header in incoming request (e.g., "hospital.com", "customer-subdomain.app.com")
- **custom_domain**: Tenant entity field storing the custom domain claimed by that tenant
- **verified_domain_status**: Tenant entity field tracking verification state: "unverified", "pending_verification", "verified", "failed"
- **DNS TXT record**: DNS record that proves domain ownership (format: `_healthystellar.hospital.com TXT "tenant-id=xyz"`)
- **Cached domain mapping**: In-memory cache mapping domain→tenant_id for fast O(1) resolution without database queries

## Bug Details

### Bug Condition

The bug manifests when ANY of three conditions hold:

1. A request arrives with Host header matching a tenant's custom domain, but no middleware resolves the request to that tenant
2. Multiple tenants can claim the same custom domain because no unique constraint exists
3. A tenant can claim any custom domain without proving DNS ownership

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type (RequestEvent | DomainClaimRequest)
  OUTPUT: boolean
  
  IF input is RequestEvent THEN
    hostHeader := extractHost(input)
    customDomainTenant := findTenantByCustomDomain(hostHeader)
    RETURN customDomainTenant EXISTS AND NOT resolvesToTenant(input, customDomainTenant)
  END IF
  
  IF input is DomainClaimRequest THEN
    newDomain := input.custom_domain
    existingClaim := findTenantWithDomain(newDomain)
    noVerification := input.verified_domain_status = "unverified"
    RETURN (existingClaim EXISTS AND existingClaim.id != input.tenantId) 
           OR noVerification
  END IF
END FUNCTION
```

### Examples

**Example 1 - Request not resolved to custom domain tenant:**
- Current: Request to "hospital.com" (Host: hospital.com) is rejected with "Tenant identifier not found" because no custom domain resolution exists
- Expected: Request resolves to Tenant A (who claimed hospital.com) and processes normally
- Bug Condition: C = host header "hospital.com" exists, tenant claimed it, but middleware doesn't resolve it

**Example 2 - Duplicate custom domain claims:**
- Current: Tenant A claims custom_domain="hospital.com", Tenant B also claims custom_domain="hospital.com", both succeed in database
- Expected: Tenant B's claim fails with unique constraint violation
- Bug Condition: C = multiple tenants holding same custom_domain value

**Example 3 - Unverified domain claim:**
- Current: Tenant claims custom_domain="competitor.com", system marks status="active" without DNS verification
- Expected: System requires DNS TXT record verification before marking domain as verified_active
- Bug Condition: C = domain claim accepted without DNS proof of ownership

**Example 4 - Preservation - subdomain still works:**
- Current: Request to "customer-a.app.com" (Host: customer-a.app.com) resolves to Tenant A via subdomain extraction
- Expected: After fix, same request continues to resolve to Tenant A
- Bug Condition: ¬C = this is a subdomain request, not a custom domain request

**Example 5 - Preservation - header still works:**
- Current: Request with header X-Tenant-ID: tenant-uuid resolves to correct tenant
- Expected: After fix, same header continues to work
- Bug Condition: ¬C = this is header-based, not a custom domain request

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- X-Tenant-ID header requests must continue resolving to the specified tenant without any change in resolution logic
- Subdomain-based resolution (e.g., "customer.app.com" → tenant-customer) must continue working identically
- Requests lacking both header and valid subdomain must continue returning BadRequestException with "Tenant identifier not found"
- Inactive or non-existent tenants must continue returning BadRequestException with "Invalid or inactive tenant"
- All downstream schema isolation (SET search_path) and context population must continue unchanged
- Performance characteristics for header and subdomain resolution must not degrade

**Scope:**
All inputs that do NOT involve custom domain resolution (requests without custom Host headers, claims on already-verified domains, requests with X-Tenant-ID headers or subdomains) should be completely unaffected by this fix. This includes:
- All existing X-Tenant-ID header routing
- All existing subdomain-based routing
- All existing inactive tenant checks
- All existing context propagation

## Hypothesized Root Cause

Based on the bug description and codebase review, the most likely issues are:

1. **Missing Middleware Layer**: The TenantInterceptor only checks X-Tenant-ID headers and subdomains. No code path exists to resolve requests by Host header against the custom_domain column. A new middleware or interceptor hook is needed.

2. **Lack of Uniqueness Constraint**: The Tenant entity has no custom_domain column yet, and once added, needs a unique constraint to prevent duplicate claims. Without this constraint, the database accepts duplicates.

3. **No DNS Verification Workflow**: No service exists to verify DNS ownership. The system needs to:
   - Generate a TXT record challenge for tenants
   - Poll for DNS resolution of that record
   - Mark domain as verified only after successful resolution
   - Ensure verified domains are used for request routing, not unverified claims

4. **Missing Caching Strategy**: Even if middleware exists to query custom_domain, querying the database for every request is inefficient. A cache mapping domain→tenant_id is needed for O(1) lookups.

5. **Schema/Entity Gap**: The Tenant entity currently has no custom_domain or verified_domain_status columns. These must be added.

## Correctness Properties

Property 1: Bug Condition - Custom Domain Request Resolution

_For any_ incoming HTTP request where the Host header matches a tenant's custom domain (and that domain is verified), the fixed system SHALL resolve the request to that tenant via cached domain mapping, populate TenantContext with the correct tenant ID and schema name, and execute the request handler in that tenant's schema context.

**Validates: Requirements 2.1**

Property 2: Bug Condition - Duplicate Domain Prevention

_For any_ API request to claim a custom domain that is already claimed by another tenant, the fixed system SHALL reject the claim with a unique constraint violation or explicit conflict response, preventing the duplicate claim from being stored.

**Validates: Requirements 2.2**

Property 3: Bug Condition - DNS Verification Requirement

_For any_ custom domain claim, the fixed system SHALL NOT mark the domain as verified_active unless the tenant has successfully verified DNS ownership via TXT record resolution, preventing unverified domains from being used for request routing.

**Validates: Requirements 2.3**

Property 4: Preservation - Header-Based Resolution

_For any_ incoming HTTP request with an X-Tenant-ID header, the fixed system SHALL resolve to that tenant using the header-based path exactly as before, with no changes to resolution logic or performance characteristics.

**Validates: Requirements 3.1**

Property 5: Preservation - Subdomain-Based Resolution

_For any_ incoming HTTP request with a valid subdomain (not containing custom domain match), the fixed system SHALL resolve to that tenant using subdomain extraction exactly as before, with no changes to resolution logic or performance characteristics.

**Validates: Requirements 3.2**

Property 6: Preservation - Missing Identifier Handling

_For any_ incoming HTTP request lacking both a valid X-Tenant-ID header and a valid subdomain, the fixed system SHALL return BadRequestException("Tenant identifier not found") exactly as before.

**Validates: Requirements 3.3**

Property 7: Preservation - Inactive Tenant Handling

_For any_ incoming HTTP request resolving to an inactive or non-existent tenant (via any resolution path), the fixed system SHALL return BadRequestException("Invalid or inactive tenant") exactly as before.

**Validates: Requirements 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the following changes will implement the fix:

**1. Entity Schema Changes - `src/tenant/entities/tenant.entity.ts`**

Add two new columns to the Tenant entity:
- `custom_domain`: Optional string field with unique constraint and index
- `verified_domain_status`: Enum field with values ["unverified", "pending_verification", "verified", "failed"], default "unverified"

Implementation details:
```typescript
@Column({ unique: true, nullable: true })
@Index()
custom_domain: string;

@Column({
  type: 'varchar',
  enum: ['unverified', 'pending_verification', 'verified', 'failed'],
  default: 'unverified',
})
verified_domain_status: string;
```

**2. Caching Service - Create `src/tenant/services/domain-cache.service.ts`**

Implement in-memory cache for domain→tenant_id mapping:
- Load all verified domains at application startup
- Listen for domain verification events to update cache
- Provide O(1) lookup method: `getTenantIdByDomain(domain: string): string | null`
- Invalidate cache entry when domain claim is removed or verification changes

Implementation details:
- Use Map<string, string> for O(1) lookups
- Populate in onModuleInit()
- Listen to domain verification events to keep cache in sync
- Handle case-insensitive domain matching

**3. DNS Verification Service - Create `src/tenant/services/dns-verification.service.ts`**

Implement DNS TXT record verification workflow:
- Generate TXT record challenge format: `_healthystellar.{domain} TXT "tenant-id={tenantId}"`
- Expose method: `initiateVerification(tenantId, domain)` that updates domain status to "pending_verification"
- Expose method: `verifyDNSRecord(domain, tenantId)` that:
  - Queries DNS for TXT record at `_healthystellar.{domain}`
  - Verifies record contains expected tenant-id value
  - On success: updates database, sets verified_domain_status="verified", emits event to update cache
  - On failure: sets verified_domain_status="failed"
- Expose method: `pollAndVerify(domain, tenantId, maxAttempts)` for async verification

**4. Domain Resolution Middleware - Create `src/tenant/middleware/custom-domain-resolution.middleware.ts`**

Implement middleware that runs BEFORE TenantInterceptor:
- Extract Host header from request
- Query DomainCacheService for tenant ID
- If found and domain is verified: set tenant context and allow request to proceed
- If found but not verified: reject with appropriate error
- If not found: allow request to pass to TenantInterceptor for fallback (subdomain/header) resolution

Implementation details:
- Check domain cache before falling back to subdomain/header resolution
- Ensure middleware runs in the correct order (before TenantInterceptor)
- Handle both standard domains and subdomains correctly (don't resolve "app.com" if "customer.app.com" is subdomain)

**5. Tenant API Changes - `src/tenant/controllers/tenant.controller.ts` and `src/tenant/services/tenant.service.ts`**

Add API endpoints and service methods:
- POST `/tenants/{id}/domains/verify-init` - Initiate DNS verification for custom domain
  - Input: { domain: string }
  - Output: { verificationChallenge: string, status: "pending_verification" }
- GET `/tenants/{id}/domains/verify-status` - Poll verification status
  - Output: { domain: string, status: string }
- PUT `/tenants/{id}/domains/claim` - Claim a custom domain (initiates verification)
  - Input: { domain: string }
  - Validation: check unique constraint, call initiateVerification()
- DELETE `/tenants/{id}/domains/{domain}` - Remove custom domain claim
  - Removes custom_domain, invalidates cache

Implementation details:
- Use TenantService to update domain columns
- Call DomainVerificationService to manage verification state
- Return verification challenge format to tenant
- Error handling: return 409 Conflict if domain already claimed by another tenant

**6. Database Migration**

Create migration to add columns to tenants table:
- ALTER TABLE tenants ADD COLUMN custom_domain VARCHAR UNIQUE NULLABLE
- ALTER TABLE tenants ADD COLUMN verified_domain_status VARCHAR DEFAULT 'unverified'
- CREATE INDEX idx_custom_domain ON tenants(custom_domain) WHERE custom_domain IS NOT NULL

## Testing Strategy

### Validation Approach

The testing strategy uses the bug condition methodology to ensure the fix handles buggy inputs correctly and preserves existing behavior:

**Phase 1 - Exploratory (Bugfix Exploration Tests)**
Run tests on UNFIXED code to surface counterexamples demonstrating the bug, confirming root cause hypotheses.

**Phase 2 - Fix Verification (Correctness Tests)**
Run tests on FIXED code to verify: for all inputs where C(X) holds, the fix produces expected behavior.

**Phase 3 - Preservation Verification (Regression Tests)**
Run tests on FIXED code to verify: for all inputs where ¬C(X) holds, the fix produces same behavior as original.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples demonstrating the bug BEFORE implementing the fix, confirming root cause analysis.

**Test Plan**: Write tests that simulate custom domain requests and duplicate domain claims on unfixed code. Observe failures to understand the root cause.

**Test Cases**:

1. **Custom Domain Request Resolution (Fails on unfixed code)**
   - Setup: Tenant A claims custom_domain="hospital.com" with verified_domain_status="verified"
   - Action: Send HTTP request with Host: hospital.com
   - Expected (unfixed): Request fails with "Tenant identifier not found" (no custom domain resolution exists)
   - Expected (fixed): Request resolves to Tenant A
   - Validates Property 1

2. **Duplicate Domain Claim (May fail on unfixed code)**
   - Setup: Tenant A claims custom_domain="hospital.com"
   - Action: Tenant B attempts to claim custom_domain="hospital.com"
   - Expected (unfixed): Both tenants have same domain in database OR random behavior
   - Expected (fixed): Tenant B's claim fails with unique constraint error
   - Validates Property 2

3. **Unverified Domain Not Resolved (Fails on unfixed code)**
   - Setup: Tenant A claims custom_domain="hospital.com" with status="unverified" (no DNS verification)
   - Action: Send HTTP request with Host: hospital.com
   - Expected (unfixed): Request incorrectly resolves to Tenant A (no verification check exists)
   - Expected (fixed): Request fails or falls back to subdomain resolution
   - Validates Property 3

4. **Out-of-Order Domain (Edge case - may fail on unfixed code)**
   - Setup: Tenant A claims custom_domain="api.hospital.com", Tenant B claims custom_domain="hospital.com"
   - Action: Send requests to both domains
   - Expected (unfixed): Ambiguous or incorrect resolution
   - Expected (fixed): Each resolves to correct tenant
   - Validates Property 1

5. **Cache Invalidation (Fails on unfixed code)**
   - Setup: Tenant A claims and verifies domain "hospital.com", cache is populated
   - Action: Tenant B claims same domain (should fail), verify cache is still correct
   - Expected (unfixed): Cache may become stale or contain invalid entries
   - Expected (fixed): Cache rejects duplicate claims, remains consistent
   - Validates Property 2

### Fix Checking

**Goal**: Verify that for all inputs where C(X) holds, the fixed function produces expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedSystem(input)
  IF input is custom domain request THEN
    ASSERT result.tenantId == expectedTenantId(input.host)
    ASSERT result.schemaName == expectedSchemaName(input.host)
    ASSERT result.contextPopulated == true
  ELSE IF input is duplicate domain claim THEN
    ASSERT result.status == 409 (Conflict)
    ASSERT database does NOT contain duplicate
  ELSE IF input is unverified domain THEN
    ASSERT result.status == 403 (Forbidden) OR falls back to subdomain
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where ¬C(X) holds, the fixed code produces same behavior as original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  resultOriginal := originalTenantInterceptor(input)
  resultFixed := fixedTenantInterceptor(input)
  ASSERT resultOriginal == resultFixed
END FOR
```

**Testing Approach**: Property-based testing with Hypothesis to generate random requests and domain configurations:
- Generate random X-Tenant-ID headers and verify resolution unchanged
- Generate random valid subdomains and verify extraction unchanged
- Generate requests lacking both header and subdomain, verify error unchanged
- Generate requests with inactive tenants, verify error unchanged

### Unit Tests

- Test DomainCacheService load, lookup, and invalidation
- Test DomainVerificationService DNS record format generation
- Test custom domain claim validation (unique constraint)
- Test middleware domain resolution order (cache check before subdomain fallback)
- Test API endpoints for domain claim/verify/status
- Test error cases: domain already claimed, verification failed, DNS timeout

### Property-Based Tests

- **Property 1 Test (Custom Domain Resolution)**: Generate random verified domains, random requests to those domains, verify resolution to correct tenant
- **Property 2 Test (Duplicate Prevention)**: Generate random domain claim sequences, verify only first claim succeeds
- **Property 3 Test (DNS Verification)**: Generate random domains and verification states, verify unverified domains don't resolve
- **Property 4 Test (Header Preservation)**: Generate random X-Tenant-ID headers, verify header-based resolution unchanged
- **Property 5 Test (Subdomain Preservation)**: Generate random valid subdomains, verify subdomain extraction unchanged
- **Property 6 Test (Missing Identifier)**: Generate requests lacking header and subdomain, verify error response unchanged
- **Property 7 Test (Inactive Tenant)**: Generate requests resolving to inactive tenants (any method), verify error unchanged

### Integration Tests

- Test full flow: Tenant claims domain → receives verification challenge → verifies DNS → domain becomes active → requests resolve
- Test custom domain request through full middleware chain with schema isolation
- Test domain claim conflict with concurrent requests
- Test cache invalidation on domain removal
- Test fallback behavior: custom domain not verified → request falls back to subdomain resolution
- Test all three resolution paths (header, subdomain, custom domain) in single test session
