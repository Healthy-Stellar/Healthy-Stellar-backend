# FHIR R4 API Implementation

## Overview
FHIR-compliant REST endpoints for external EHR system integration under `/fhir/r4` base path.

## Endpoints

### Metadata
- `GET /fhir/r4/metadata` - CapabilityStatement resource

### Patient Resources
- `GET /fhir/r4/Patient/:id` - FHIR Patient resource
- `GET /fhir/r4/Patient/:id/DocumentReference` - All medical records as DocumentReference bundle

### Document Resources
- `GET /fhir/r4/DocumentReference/:id` - Single medical record as DocumentReference

### Consent Resources
- `GET /fhir/r4/Consent/:id` - Access grants as Consent resource

### Provenance Resources
- `GET /fhir/r4/Provenance?target=DocumentReference/:id` - Audit trail as Provenance bundle

### Bulk Data Export ($export)
- `GET /fhir/r4/Patient/$export?_type=Patient,DocumentReference,Consent,Provenance` - Initiate async bulk export
- `GET /fhir/r4/$export-status/:jobId` - Check export job status or download manifest
- `DELETE /fhir/r4/$export-status/:jobId` - Cancel in-progress export

## Bulk Data Access Specification

The FHIR Bulk Data Access API enables asynchronous export of large datasets for analytics and reporting.

### Workflow

1. **Initiate Export**: `GET /fhir/r4/Patient/$export`
   - Returns `202 Accepted` with `Content-Location` header pointing to status URL
   - Supported `_type` params: Patient, DocumentReference, Consent, Provenance
   - Export scoped to authenticated patient's data (ADMIN role exports all data)

2. **Check Status**: `GET /fhir/r4/$export-status/:jobId`
   - Returns job progress while processing
   - Returns download manifest when complete with NDJSON file URLs on IPFS

3. **Cancel Export**: `DELETE /fhir/r4/$export-status/:jobId`
   - Cancels in-progress or pending export jobs

### Export Format
- NDJSON (newline-delimited JSON) - one FHIR resource per line
- Files stored on IPFS with `ipfs://` URLs
- Exports expire after 24 hours (automatic cleanup)

### Processing
- Jobs dispatched via BullMQ for async processing
- Streaming approach to avoid memory issues with large datasets
- Progress tracking and error handling

## Features

✅ All responses include `Content-Type: application/fhir+json`
✅ FHIR OperationOutcome for all error responses
✅ JWT auth and RBAC guards applied
✅ CapabilityStatement at `/fhir/r4/metadata`
✅ Bulk Data Access ($export) specification
✅ Async job processing with BullMQ
✅ NDJSON export format
✅ IPFS storage integration
✅ 24-hour export expiration with cleanup
✅ Patient-scoped and admin-level exports
✅ Integration tests validate FHIR R4 JSON schema compliance

## Authentication
All FHIR endpoints require JWT authentication via `Authorization: Bearer <token>` header.

## Testing
```bash
npm run test:e2e -- fhir-api.e2e-spec.ts
```
