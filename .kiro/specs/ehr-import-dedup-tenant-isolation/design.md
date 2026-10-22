# EHR Import Deduplication and Tenant Isolation - Bugfix Design

## Overview

The ImportService.enqueue() method currently deduplicates jobs based solely on file hash (importBatchId), ignoring both the dry-run flag and tenant context. This causes two critical failures:

1. **Workflow Breakage**: Performing a dry run followed by a real import of the same file silently fails—the real import returns the dry-run job instead of creating a new job, so no records are created.
2. **Cross-Tenant Data Isolation Violation**: Different tenants uploading the same file receive the same job ID, causing data loss if one tenant imported before the other.

The fix ensures deduplication is scoped correctly by tenant and import mode, and that responses include dryRun and tenantId information for proper client-side workflow handling.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug—when a file is uploaded (dry-run or real) and a completed job with the same hash exists without accounting for tenant or dry-run flag
- **Property (P)**: The desired behavior—new jobs are created when dry-run status differs or tenant differs, enabling dry-run-then-real workflows and isolating tenants
- **Preservation**: Existing behavior that must remain unchanged—deduplication of identical non-dry-run imports by the same tenant within the same session
- **enqueue()**: The function in `src/ehr-import/import.service.ts` that accepts file uploads, deduplicates against prior jobs, creates new ImportJob records, and enqueues processing tasks
- **importBatchId**: SHA-256 hash of file content; current deduplication key (insufficient)
- **dryRun**: Boolean flag indicating whether the import should execute without creating database records
- **tenantId**: Unique identifier for the tenant organization; obtained from TenantContext.getTenantId()
- **ImportJob**: TypeORM entity representing an import task with status, counts, and metadata

## Bug Details

### Bug Condition

The bug manifests when any of these conditions occur:
1. A completed dry-run import exists for a file, and the same file is uploaded for a real import
2. Tenant A completes an import of a file, and tenant B uploads the same file
3. The deduplication check finds a completed job by hash alone, ignoring both dryRun flag and tenant scope

The enqueue() function finds the job using only importBatchId and status, without checking dryRun or tenant context.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type UploadRequest {
    fileBuffer: Buffer,
    dryRun: boolean,
    currentTenantId: string
  }
  OUTPUT: boolean
  
  existingJob := findJobByHash(sha256(input.fileBuffer))
  IF existingJob.status == COMPLETED THEN
    IF input.dryRun != existingJob.dryRun THEN
      RETURN true  // Bug: different dry-run status not considered
    END IF
    IF input.currentTenantId != existingJob.tenantId THEN
      RETURN true  // Bug: different tenant not considered
    END IF
  END IF
  RETURN false
END FUNCTION
```

### Examples

**Example 1 - Dry-Run Then Real Import (Workflow Breakage)**
- Tenant A uploads file "patients.csv", dryRun=true → Job created, dryRun=true, no records created
- Tenant A uploads same file, dryRun=false → Bug: System returns Job from step 1 (still dryRun=true), no new job created, no records created
- Expected: System should create new Job with dryRun=false and process the import

**Example 2 - Cross-Tenant Isolation Violation**
- Tenant A uploads file "patients.csv" → Job created, tenantId=org-1, 500 records imported successfully
- Tenant B uploads same file "patients.csv" → Bug: System returns Job from step 1 (tenantId=org-1), no new job created, tenant B's data is never imported
- Expected: System should create new Job with tenantId=org-2 and process tenant B's import independently

**Example 3 - Edge Case: Out of Scope (Not a Bug)**
- Tenant A uploads file, dryRun=false → Job A created, completed, 500 records imported
- Tenant A uploads same file, dryRun=false → System correctly returns Job A (deduplication working as intended)
- Expected: Returns Job A; this is preservation, not a bug

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Uploading the same non-dry-run file twice by the same tenant within the same session must continue to return the existing completed job and not re-import
- Job status queries must continue to return accurate counts (total, processed, succeeded, failed)
- Dry-run mode must continue to execute without creating database records
- Reprocessing failed records must continue to create new jobs with unique identifiers

**Scope:**
All inputs where the bug condition does NOT hold (same tenant, same dryRun status, same file) should be completely unaffected by this fix. Non-import workflows and other services remain unchanged.

## Hypothesized Root Cause

Based on the bug description and code analysis:

1. **Missing Tenant Scoping in Deduplication Query**: The findOne query at line 62-65 checks only importBatchId and status, with no tenant filter. Should include tenantId in the WHERE clause after it is added to the entity.

2. **Missing dryRun Flag in Deduplication Logic**: The deduplication check does not compare the incoming dryRun parameter against the found job's dryRun field. Should add a condition: `(existing.dryRun === dryRun)`.

3. **Missing tenantId Column on ImportJob Entity**: The ImportJob entity has no tenantId column. Must add a @Column with NOT NULL constraint and database index for query performance.

4. **Missing Tenant Context Extraction in enqueue()**: The enqueue() method receives no tenant parameter and has no call to TenantContext.getTenantId(). Must extract the tenant context and pass it when creating and checking jobs.

5. **Response Missing dryRun and tenantId**: The enqueue() return type is `{ jobId, importBatchId }`. Response should include dryRun and tenantId for client workflows to verify correctness.

## Correctness Properties

Property 1: Bug Condition - Dry-Run and Tenant-Aware Deduplication

_For any_ file upload where the incoming dry-run status differs from an existing completed job OR the current tenant differs from the job's tenant, the fixed enqueue() function SHALL create a new ImportJob instead of returning the existing job. The new job's dryRun and tenantId fields SHALL match the current request context, ensuring that dry-run-then-real import workflows succeed and tenant data remains isolated.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Same-Tenant Same-Mode Deduplication

_For any_ file upload by the same tenant with the same dry-run status as an existing completed job with identical file hash, the fixed enqueue() function SHALL return the existing job without creating a new one, preserving deduplication behavior for legitimate upload retries.

**Validates: Requirements 3.1**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the fix requires modifications to three layers:

**File: `src/ehr-import/entities/import-job.entity.ts`**

**Entity Changes:**
1. **Add tenantId Column**: Add a NOT NULL string column `tenantId` to ImportJob entity to store the organization identifier
2. **Update Unique Index**: Modify the unique index on `importBatchId` to be a composite index on `(importBatchId, dryRun, tenantId)` ensuring uniqueness across the three-field combination
3. **Add Index on tenantId**: Add a non-unique index on tenantId for efficient filtering by tenant

**File: `src/ehr-import/import.service.ts` (enqueue method)**

**Deduplication Logic Changes:**
1. **Extract Tenant Context**: At the start of enqueue(), call `TenantContext.getTenantId()` to obtain the current tenant ID; throw ForbiddenException if missing
2. **Update Deduplication Query**: Change the findOne query from checking only `{ importBatchId }` to include `{ importBatchId, dryRun, tenantId: currentTenantId }`
3. **Set tenantId on New Job**: When creating a new ImportJob, set the tenantId field to the extracted tenant context
4. **Extend Response Type**: Change return type from `{ jobId, importBatchId }` to `{ jobId, importBatchId, dryRun, tenantId }`

**Database Migration:**
- Create migration script to:
  - Add tenantId column (NOT NULL with default UUID for existing records)
  - Drop old unique index on importBatchId
  - Create new composite unique index on (importBatchId, dryRun, tenantId)
  - Create index on tenantId

### Implementation Pseudocode

```
FUNCTION enqueue(fileBuffer, originalName, dryRun=false, columnMap?, quarantineMode=false)
  // 1. Extract and validate tenant context
  currentTenantId := TenantContext.getTenantId()
  IF NOT currentTenantId THEN
    THROW ForbiddenException("Tenant context not found")
  END IF
  
  // 2. Compute file hash as before
  format := _detectFormat(originalName, fileBuffer)
  importBatchId := sha256(fileBuffer)
  
  // 3. Check for existing job with tenant and dryRun scoping (FIXED)
  existing := jobRepo.findOne({
    WHERE: {
      importBatchId: importBatchId,
      tenantId: currentTenantId,
      dryRun: dryRun
    }
  })
  IF existing AND existing.status == COMPLETED THEN
    RETURN {
      jobId: existing.id,
      importBatchId: existing.importBatchId,
      dryRun: existing.dryRun,
      tenantId: existing.tenantId
    }
  END IF
  
  // 4. Create new job with tenant and dryRun (FIXED)
  job := jobRepo.save(jobRepo.create({
    importBatchId: importBatchId,
    format: format,
    dryRun: dryRun,
    quarantineMode: quarantineMode,
    tenantId: currentTenantId  // ADDED
  }))
  
  // 5. Enqueue processing (unchanged)
  tempFilePath := tempStorage.writeBuffer(job.id, fileBuffer, originalName)
  jobDto := {
    jobId: job.id,
    tempFilePath: tempFilePath,
    originalName: originalName,
    format: format,
    dryRun: dryRun,
    quarantineMode: quarantineMode,
    columnMap: columnMap
  }
  importQueue.add('process', jobDto, { jobId: job.id, attempts, backoff })
  
  // 6. Return extended response (FIXED)
  RETURN {
    jobId: job.id,
    importBatchId: job.importBatchId,
    dryRun: job.dryRun,
    tenantId: job.tenantId
  }
END FUNCTION
```

## Testing Strategy

### Validation Approach

The testing strategy uses a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Observe the bugs in unfixed code before implementing the fix. Confirm root causes and understand failure modes.

**Test Plan**: Write integration tests that simulate the documented workflows (dry-run followed by real import, cross-tenant uploads) against the unfixed code. Observe that jobs are incorrectly reused across dry-run boundaries and tenant boundaries.

**Test Cases**:
1. **Dry-Run Then Real Import Bug**: Upload file with dryRun=true, verify job created with dryRun=true. Then upload same file with dryRun=false, observe that unfixed code returns the dry-run job instead of creating a new one (failing test on unfixed code).
2. **Cross-Tenant Isolation Bug**: Upload file as tenant-1, verify job created with tenantId=tenant-1. Then upload same file as tenant-2, observe that unfixed code returns tenant-1's job instead of creating a new one (failing test on unfixed code).
3. **Deduplication Query Missing dryRun Scope**: Verify the findOne query does not filter by dryRun, allowing different dry-run status to be ignored (code inspection).
4. **Deduplication Query Missing Tenant Scope**: Verify the findOne query does not filter by tenantId, allowing different tenants to share jobs (code inspection).

**Expected Counterexamples**:
- Second upload with different dryRun status returns the first job instead of creating a new one
- Second upload by different tenant returns the first tenant's job
- Response lacks dryRun and tenantId fields, preventing client-side verification

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed enqueue() function creates new jobs and returns correct metadata.

**Pseudocode:**
```
FOR ALL fileBuffer, dryRun1, dryRun2, tenantId1, tenantId2 WHERE
  (dryRun1 != dryRun2 OR tenantId1 != tenantId2)
DO
  job1 := enqueue_fixed(fileBuffer, dryRun1, tenantId1)
  job2 := enqueue_fixed(fileBuffer, dryRun2, tenantId2)
  
  ASSERT job1.jobId != job2.jobId  // Different jobs created
  ASSERT job2.dryRun == dryRun2     // Correct dryRun in response
  ASSERT job2.tenantId == tenantId2 // Correct tenantId in response
  ASSERT job1.tenantId == tenantId1 // First job unaffected
  ASSERT job1.dryRun == dryRun1     // First job unaffected
END FOR
```

### Preservation Checking

**Goal**: Verify that for inputs where the bug condition does NOT hold (same tenant, same dryRun, same file), the fixed function produces the same behavior as the original.

**Pseudocode:**
```
FOR ALL fileBuffer, dryRun, tenantId WHERE
  NOT (dryRun differs OR tenantId differs)
DO
  job1 := enqueue_fixed(fileBuffer, dryRun, tenantId)
  job2 := enqueue_fixed(fileBuffer, dryRun, tenantId)
  
  ASSERT job1.jobId == job2.jobId  // Same job returned (deduplication preserved)
  ASSERT job2.dryRun == job1.dryRun
  ASSERT job2.tenantId == job1.tenantId
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because it generates many combinations of files, dry-run flags, and tenants automatically, catching edge cases and providing confidence that behavior is unchanged for legitimate deduplication scenarios.

**Test Plan**: 
1. First observe unfixed code behavior for legitimate deduplication (same tenant, same dryRun, same file)
2. Write property-based tests generating random files and verifying deduplication is preserved
3. Add property tests for cross-tenant scenarios ensuring jobs are isolated

**Test Cases**:
1. **Same File Same Mode Same Tenant - Deduplication Preserved**: Upload file with dryRun=false as tenant-1, then upload same file with dryRun=false as tenant-1, verify same job is returned (deduplication working).
2. **Response Includes Required Metadata**: Verify all enqueue() responses include jobId, importBatchId, dryRun, and tenantId fields.
3. **Tenant Context Extraction**: Verify TenantContext.getTenantId() is called and missing tenant throws ForbiddenException.
4. **Database Index Performance**: Verify composite index on (importBatchId, dryRun, tenantId) exists for efficient lookups.

### Unit Tests

- Test that enqueue() calls TenantContext.getTenantId() and throws if missing
- Test deduplication query includes importBatchId, dryRun, and tenantId conditions
- Test new jobs have tenantId set to extracted tenant context
- Test response includes dryRun and tenantId fields
- Test that reprocess() continues to work correctly with new tenantId column

### Property-Based Tests

- Generate random files and verify: if uploaded twice with same dryRun and tenant, same job is returned (deduplication)
- Generate random files and verify: if uploaded with different dryRun flags, different jobs are created
- Generate random files and verify: if uploaded by different tenants, different jobs are created
- Generate random tenants and dry-run combinations, verify isolation is maintained across scenarios

### Integration Tests

- Test complete workflow: dry-run import followed by real import of same file, verify two separate jobs are created and processed
- Test multi-tenant workflow: tenant-1 imports file, tenant-2 imports same file, verify separate jobs and records
- Test status queries: verify job status correctly reflects tenant and dry-run context
- Test error export: verify errors are filtered by job tenant (no cross-tenant data leakage)
