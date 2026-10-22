# Bugfix Requirements Document

## Introduction

The ImportService.enqueue() method deduplicates based solely on the SHA-256 hash of the file content, ignoring both the dry-run flag and tenant context. This creates two critical issues:

1. **Workflow Breakage**: A documented workflow of performing a dry run first and then a real import silently fails—the real import returns the dry-run job instead of creating a new import, leaving no records created.
2. **Cross-Tenant Data Isolation Violation**: Different tenants uploading the same file receive the same job ID, causing tenant B's data to be silently dropped if tenant A imported the file first.

This bugfix ensures that deduplication is scoped correctly by tenant and import mode, and that responses accurately reflect the job's mode and tenant context.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a dry-run import is completed and the same file is uploaded for a real import by the same tenant THEN the system returns the existing dry-run job instead of creating a new import job, and no records are created

1.2 WHEN tenant A completes an import and tenant B uploads the same file THEN the system returns tenant A's completed job instead of creating a new job for tenant B, and tenant B's data is never imported

1.3 WHEN checking for existing jobs, the system considers only importBatchId and status, ignoring the dryRun flag THEN completed dry-run imports block real imports of the same file

1.4 WHEN checking for existing jobs, the system has no tenant context in the deduplication query THEN jobs are found and reused across tenants

### Expected Behavior (Correct)

2.1 WHEN a dry-run import is completed and the same file is uploaded for a real import by the same tenant THEN the system creates a new import job and processes the file as a real import

2.2 WHEN tenant A completes an import and tenant B uploads the same file THEN the system creates a new import job for tenant B scoped to tenant B's context

2.3 WHEN checking for existing jobs, the system SHALL include the dryRun flag in the deduplication check THEN only non-dry-run completed jobs block subsequent uploads of the same file

2.4 WHEN checking for existing jobs, the system SHALL include the tenant ID in the deduplication scope THEN job lookups are scoped to the current tenant only

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the same non-dry-run file is uploaded twice by the same tenant within the same import session THEN the system SHALL CONTINUE TO return the completed job and not re-import

3.2 WHEN querying job status, THEN the system SHALL CONTINUE TO return accurate status information including total, processed, succeeded, failed counts

3.3 WHEN performing a dry-run import THEN the system SHALL CONTINUE TO execute the import in dry-run mode without creating records

3.4 WHEN reprocessing failed records from a completed job THEN the system SHALL CONTINUE TO create new reprocess jobs with unique identifiers
