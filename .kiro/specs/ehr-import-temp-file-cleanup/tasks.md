# Implementation Plan: EHR Import Temp File Cleanup

## Phase 1: Exploration - Confirm the Bug

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Temp file persists on all error paths
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to concrete failing case(s):
    - Error stage: read_error, parse_error, ipfs_error, stellar_error, database_error
    - For each error condition, verify temp file is NOT deleted on unfixed code
  - Test implementation details from Bug Condition in design:
    - Create temp file and simulate error at each stage (read, parse, IPFS, Stellar, database)
    - Assert that fileExists(tempFilePath) == true after error occurs (bug: file not deleted)
    - Verify job status is FAILED
  - The test assertions should match the Expected Behavior Properties from design
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
    - Counterexample: After read error on unfixed code, temp file still exists
    - Counterexample: After parse error on unfixed code, temp file still exists
    - Counterexample: After IPFS error on unfixed code, temp file still exists
    - Counterexample: After Stellar error on unfixed code, temp file still exists
    - Counterexample: After database error on unfixed code, temp file still exists
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

## Phase 2: Preservation - Baseline Behavior

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Success path and concurrent job isolation unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (success scenarios)
  - Record observed outputs:
    - Success case 1: Valid HL7 record → job completes → temp file IS deleted
    - Success case 2: Valid CCD record → job completes → temp file IS deleted
    - Success case 3: Valid CSV record → job completes → temp file IS deleted
    - Concurrent case: Multiple jobs with different temp files → each temp file deleted independently
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - Property: For all valid records in any format, after successful processing, fileExists(tempFilePath) == false
    - Property: For all concurrent jobs with disjoint temp files, each job deletes only its own temp file
    - Property: After batch completion (mixed success/failure), temp file is deleted regardless of per-record errors
  - Property-based testing generates many valid record combinations for stronger preservation guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
    - Observation: Valid HL7 records process successfully and temp file is deleted
    - Observation: Valid CCD records process successfully and temp file is deleted
    - Observation: Valid CSV records process successfully and temp file is deleted
    - Observation: Concurrent jobs each delete only their own temp file
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

## Phase 3: Implementation - Apply the Fix

- [ ] 3. Fix for temp file cleanup on all error paths and add encryption

  - [ ] 3.1 Add finally block to EhrImportProcessor.process()
    - Wrap entire job processing logic in try-finally
    - In finally block: unconditionally delete temp file if it exists
    - This ensures cleanup happens regardless of success or failure
    - Implementation: Add finally block that calls `await this.tempStorage.deleteFile(tempFilePath)` with error suppression (catch and log, don't throw)
    - Remove redundant deletion from success path (line 182 deleteFile call) since finally handles it
    - File: `src/ehr-import/ehr-import.processor.ts`
    - _Bug_Condition: When any error occurs, temp file must be deleted before process() returns_
    - _Expected_Behavior: For all errorCondition in [read, parse, ipfs, stellar, database], fileExists(tempFilePath) == false after process() completes_
    - _Preservation: Success path unchanged - temp files still deleted at end; file isolation maintained; error logging unchanged_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [ ] 3.2 Add encryption for temp files at rest in TempStorageService
    - Implement encryption in writeBuffer() before fs.writeFileSync()
    - Generate random IV per write, use encryption key from config (or master key)
    - Store IV + encrypted data to disk (IV can be prefix or stored separately)
    - Implement decryption in readFile() after fs.readFileSync()
    - Add graceful degradation: if encryption key not configured, write unencrypted (backward compatible)
    - File: `src/ehr-import/services/temp-storage.service.ts`
    - Functions: `writeBuffer()`, `readFile()`, new helper methods `_encrypt()` and `_decrypt()`
    - Config: Add EHR_IMPORT_ENCRYPTION_KEY environment variable
    - _Preservation: Encryption is transparent - readFile() returns decrypted buffer just as before_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.3 Create TempFileSweeperService for scheduled orphan cleanup
    - Scan temp directory for files matching pattern `{jobId}-*` older than threshold (e.g., 24 hours)
    - Delete stale temp files, log results
    - Register sweep schedule in configuration (default: daily or every 6 hours)
    - File: `src/ehr-import/services/temp-file-sweeper.service.ts` (new file)
    - Config: Add EHR_IMPORT_TEMP_SWEEP_INTERVAL environment variable
    - Integration: Add TempFileSweeperService to EhrImportModule providers
    - Start sweeper on module initialization via onModuleInit()
    - _Preservation: Sweeper only deletes orphaned files (>24hrs old), not active temp files_
    - _Requirements: 2.1, 2.2, 2.3_

## Phase 4: Validation - Verify Fix Works

- [ ] 4. Verify bug condition exploration test now passes
  - **Property 1: Expected Behavior** - Temp file deleted on all error paths
  - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
  - The test from task 1 encodes the expected behavior - it asserts fileExists(tempFilePath) == false after error
  - When this test passes, it confirms the expected behavior is satisfied
  - Run bug condition exploration test from step 1 on FIXED code
  - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - All error scenarios now delete temp file before process() returns
    - No counterexamples of temp files persisting after errors
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [ ] 5. Verify preservation tests still pass
  - **Property 2: Preservation** - Success path and concurrent job isolation unchanged
  - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
  - Run preservation property tests from step 2 on FIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Success path still deletes temp files
    - Concurrent jobs still maintain isolation
    - Encrypted temp files are transparently decrypted on read
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 6. Checkpoint - All tests pass and integration verified
  - Ensure all exploration tests pass (bug is fixed)
  - Ensure all preservation tests pass (no regressions)
  - Run full integration tests: upload → process (success and all error paths) → verify cleanup
  - Verify encryption/decryption works transparently
  - Verify temp file sweeper identifies and cleans stale files
  - Confirm no new test failures in existing test suite
  - Mark complete when all validations pass
