# EHR Import Deduplication and Tenant Isolation - Implementation Tasks

## Overview

This task list implements the bugfix for EHR import deduplication and tenant isolation. The workflow follows the bug condition methodology: write tests BEFORE fixing, observe actual behavior, then implement the fix while verifying both the bug is fixed and existing behavior is preserved.

## Phase 1: Exploratory Testing

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Dry-Run and Cross-Tenant Isolation
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: Scope to concrete failing cases: (dryRun differs) OR (tenantId differs)
  - Test that when uploading the same file with different dryRun status OR different tenantId, the unfixed enqueue() incorrectly returns the existing job instead of creating a new one
  - From Bug Condition in design: Test isBugCondition(input) where (dryRun differs) OR (tenantId differs)
  - Run test on UNFIXED code - expect FAILURE (this confirms bugs exist)
  - Document counterexamples found:
    - "enqueue(fileBuffer, dryRun=true, tenantId=org-1) returns job1, then enqueue(fileBuffer, dryRun=false, tenantId=org-1) returns job1 instead of creating job2"
    - "enqueue(fileBuffer, dryRun=false, tenantId=org-1) returns job1, then enqueue(fileBuffer, dryRun=false, tenantId=org-2) returns job1 instead of creating job2"
  - Mark task complete when test is written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

## Phase 2: Preservation Testing

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Same-Tenant Same-Mode Deduplication
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: When uploading the same file twice with same dryRun status and same tenantId on unfixed code, enqueue() returns the same job (deduplication)
  - Write property-based test: For all fileBuffer, dryRun, tenantId where conditions are identical, enqueue(fileBuffer, dryRun, tenantId) on second call returns same jobId as first call
  - From Preservation Requirements in design (section 3.1)
  - Verify test passes on UNFIXED code (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

## Phase 3: Implementation

- [ ] 3. Implement tenant isolation and dryRun-aware deduplication

  - [ ] 3.1 Add tenantId column to ImportJob entity
    - Add @Column({ type: 'varchar', nullable: false }) tenantId: string to ImportJob
    - Update @Index decorator on importBatchId to composite: @Index(['importBatchId', 'dryRun', 'tenantId'], { unique: true })
    - Add separate @Index(['tenantId']) for efficient tenant filtering
    - _Bug_Condition: Missing tenantId column prevents tenant-scoped deduplication_
    - _Expected_Behavior: New composite index ensures unique jobs per (file, dryRun, tenantId) tuple_
    - _Preservation: Existing columns and entities unchanged_
    - _Requirements: 2.2, 2.4_

  - [ ] 3.2 Extract tenant context in enqueue() method
    - Import TenantContext service at top of import.service.ts
    - Add tenant extraction: `const currentTenantId = TenantContext.getTenantId();`
    - Throw ForbiddenException if tenantId is missing: `if (!currentTenantId) throw new ForbiddenException(...)`
    - Place tenant extraction at start of enqueue() method after format detection
    - _Bug_Condition: No tenant context extraction means deduplication cannot be tenant-scoped_
    - _Expected_Behavior: Current tenant context is extracted and validated_
    - _Preservation: Method signature unchanged; only internal logic modified_
    - _Requirements: 2.1, 2.2_

  - [ ] 3.3 Update deduplication query to include dryRun and tenantId
    - Change findOne query from: `{ where: { importBatchId } }`
    - To: `{ where: { importBatchId, dryRun, tenantId: currentTenantId } }`
    - This ensures only jobs with matching file hash, dry-run status, AND tenant are returned
    - _Bug_Condition: Current query ignores dryRun and tenantId, causing cross-boundary job reuse_
    - _Expected_Behavior: Deduplication query includes all three dimensions_
    - _Preservation: Status check remains; existing completed job deduplication for same tenant/mode preserved_
    - _Requirements: 2.1, 2.3, 2.4_

  - [ ] 3.4 Set tenantId when creating new ImportJob
    - When calling jobRepo.create(), add tenantId: currentTenantId to the object
    - Ensure tenantId is set on all new jobs created in enqueue(), reprocess(), and related paths
    - _Bug_Condition: Missing tenantId assignment means newly created jobs have no tenant context_
    - _Expected_Behavior: All new jobs are created with correct tenant context_
    - _Preservation: Job creation flow unchanged; only field assignment added_
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 3.5 Extend enqueue() response to include dryRun and tenantId
    - Change return type from `{ jobId, importBatchId }` to `{ jobId, importBatchId, dryRun, tenantId }`
    - Include dryRun and tenantId in the returned object
    - This enables clients to verify the job mode and tenant for workflow handling
    - _Bug_Condition: Missing response fields prevent clients from verifying job context_
    - _Expected_Behavior: Response includes all necessary metadata for client-side workflow validation_
    - _Preservation: jobId and importBatchId still returned; only fields added_
    - _Requirements: 2.1, 2.2_

  - [ ] 3.6 Create database migration
    - Create migration file in src/database/migrations/
    - Migration steps:
      - Add tenantId column: ALTER TABLE import_jobs ADD COLUMN tenantId VARCHAR NOT NULL DEFAULT uuid_generate_v4()
      - Drop old unique index: DROP INDEX IF EXISTS IDX_importjobs_importbatchid
      - Create composite unique index: CREATE UNIQUE INDEX IDX_importjobs_batch_dryrun_tenant ON import_jobs(importBatchId, dryRun, tenantId)
      - Create tenant index: CREATE INDEX IDX_importjobs_tenantid ON import_jobs(tenantId)
    - Update migration list in main migration module
    - _Bug_Condition: Old index structure allows job reuse across tenants and dry-run boundaries_
    - _Expected_Behavior: New composite index enforces correct scoping_
    - _Preservation: All data preserved; migration is additive_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 4. Verify bug condition exploration test now passes
  - **Property 1: Expected Behavior** - Dry-Run and Cross-Tenant Isolation Fixed
  - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
  - After implementing the fix, re-run the bug condition exploration test
  - The test from task 1 encodes the expected behavior: new jobs should be created when dryRun or tenantId differs
  - When this test passes, it confirms the expected behavior is satisfied
  - Run bug condition exploration test from step 1
  - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
  - Verify with concrete examples:
    - Second upload with different dryRun now creates new job instead of returning first job
    - Second upload by different tenant now creates new job instead of returning first job
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 5. Verify preservation tests still pass
  - **Property 2: Preservation** - Same-Tenant Same-Mode Deduplication Preserved
  - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
  - Run preservation property tests from step 2
  - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
  - Confirm deduplication still works correctly:
    - Same file, same dryRun, same tenant returns same job
    - Response includes correct metadata
    - Status queries return accurate information
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 6. Checkpoint - Verify all tests pass and no regressions
  - Run full test suite for import service: npm test -- src/ehr-import/
  - Ensure all unit, integration, and property-based tests pass
  - Verify no other services or features are affected by tenantId column addition
  - Document any issues or questions

