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

## Features

✅ All responses include `Content-Type: application/fhir+json`
✅ FHIR OperationOutcome for all error responses
✅ JWT auth and RBAC guards applied
✅ CapabilityStatement at `/fhir/r4/metadata`
✅ Integration tests validate FHIR R4 JSON schema compliance

## Authentication
All FHIR endpoints require JWT authentication via `Authorization: Bearer <token>` header.

## Testing
```bash
npm run test:e2e -- fhir-api.e2e-spec.ts
```
