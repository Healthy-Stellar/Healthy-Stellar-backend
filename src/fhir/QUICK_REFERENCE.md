# FHIR Bulk Export - Quick Reference

## Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/fhir/r4/Patient/$export` | Initiate export | 202 + Content-Location |
| GET | `/fhir/r4/$export-status/:jobId` | Check status | 200 + status/manifest |
| DELETE | `/fhir/r4/$export-status/:jobId` | Cancel export | 204 No Content |

## Query Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `_type` | Patient, DocumentReference, Consent, Provenance | All | Resource types to export |

## Response Formats

### In Progress
```json
{
  "status": "in_progress",
  "progress": 45,
  "totalResources": 1000
}
```

### Completed
```json
{
  "transactionTime": "2026-02-22T15:30:00Z",
  "request": "/fhir/r4/Patient/$export?_type=Patient",
  "requiresAccessToken": true,
  "output": [
    {
      "type": "Patient",
      "url": "ipfs://Qm...",
      "count": 1
    }
  ]
}
```

## Job Statuses

- `pending` - Queued, not started
- `in_progress` - Currently processing
- `completed` - Finished, files available
- `failed` - Error occurred
- `cancelled` - Cancelled by user

## Access Control

| Role | Scope |
|------|-------|
| PATIENT | Own data only |
| ADMIN | All data |

## Expiration

- Exports expire **24 hours** after completion
- Cleanup runs **hourly**
- Download files promptly

## Example Usage

```bash
# 1. Start export
curl -X GET "http://localhost:3000/fhir/r4/Patient/\$export?_type=Patient" \
  -H "Authorization: Bearer TOKEN"

# 2. Check status
curl -X GET "http://localhost:3000/fhir/r4/\$export-status/JOB_ID" \
  -H "Authorization: Bearer TOKEN"

# 3. Cancel (optional)
curl -X DELETE "http://localhost:3000/fhir/r4/\$export-status/JOB_ID" \
  -H "Authorization: Bearer TOKEN"
```

## File Format

**NDJSON** - One FHIR resource per line:
```ndjson
{"resourceType":"Patient","id":"1","name":[{"family":"Doe"}]}
{"resourceType":"Patient","id":"2","name":[{"family":"Smith"}]}
```

## Error Codes

| Status | Code | Meaning |
|--------|------|---------|
| 401 | unauthorized | Missing/invalid token |
| 403 | forbidden | Access denied |
| 404 | not-found | Job doesn't exist |

## Configuration

### Queue
- Name: `fhir-bulk-export`
- Backend: BullMQ + Redis

### Database
- Table: `bulk_export_jobs`
- Migration: `1771771003000-CreateBulkExportJobsTable.ts`

### Cleanup
- Schedule: Every hour
- Task: `BulkExportCleanupTask`

## Testing

```bash
# Unit tests
npm run test -- bulk-export.service.spec

# E2E tests
npm run test:e2e -- fhir-bulk-export.e2e-spec
```

## Key Files

- Service: `src/fhir/services/bulk-export.service.ts`
- Controller: `src/fhir/controllers/fhir.controller.ts`
- Processor: `src/fhir/processors/bulk-export.processor.ts`
- Entity: `src/fhir/entities/bulk-export-job.entity.ts`
- Cleanup: `src/fhir/tasks/bulk-export-cleanup.task.ts`
