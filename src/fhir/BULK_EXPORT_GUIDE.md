# FHIR Bulk Data Export - Usage Examples

## Overview
The FHIR Bulk Data Access API enables asynchronous export of large healthcare datasets following the [FHIR Bulk Data Access specification](https://hl7.org/fhir/uv/bulkdata/).

## Authentication
All requests require a valid JWT token:
```bash
Authorization: Bearer <your-jwt-token>
```

## Workflow

### 1. Initiate Export

**Request:**
```bash
GET /fhir/r4/Patient/$export?_type=Patient,DocumentReference,Consent,Provenance
Authorization: Bearer <token>
```

**Response:**
```
HTTP/1.1 202 Accepted
Content-Location: /fhir/r4/$export-status/550e8400-e29b-41d4-a716-446655440000
```

**Query Parameters:**
- `_type` (optional): Comma-separated list of resource types to export
  - Supported: `Patient`, `DocumentReference`, `Consent`, `Provenance`
  - Default: All supported types

### 2. Check Export Status

**Request:**
```bash
GET /fhir/r4/$export-status/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
```

**Response (In Progress):**
```json
{
  "status": "in_progress",
  "progress": 45,
  "totalResources": 1000
}
```

**Response (Completed):**
```json
{
  "transactionTime": "2026-02-22T15:30:00.000Z",
  "request": "/fhir/r4/Patient/$export?_type=Patient,DocumentReference",
  "requiresAccessToken": true,
  "output": [
    {
      "type": "Patient",
      "url": "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
      "count": 1
    },
    {
      "type": "DocumentReference",
      "url": "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
      "count": 15
    }
  ]
}
```

### 3. Download Export Files

Export files are stored on IPFS in NDJSON format (one FHIR resource per line).

**Example NDJSON content:**
```ndjson
{"resourceType":"Patient","id":"patient-1","name":[{"family":"Doe","given":["John"]}]}
{"resourceType":"Patient","id":"patient-2","name":[{"family":"Smith","given":["Jane"]}]}
```

Access files via IPFS gateway:
```bash
curl https://ipfs.io/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco
```

### 4. Cancel Export (Optional)

**Request:**
```bash
DELETE /fhir/r4/$export-status/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
```

**Response:**
```
HTTP/1.1 204 No Content
```

## Access Control

### Patient Users
- Can only export their own data
- Scoped to resources where `patientId` matches authenticated user

### Admin Users
- Can export all data across all patients
- No patient-level filtering applied

## Export Expiration

- Completed exports expire after **24 hours**
- Expired exports are automatically cleaned up
- Download files before expiration

## Error Handling

**Job Not Found:**
```json
{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "not-found",
    "diagnostics": "Export job not found"
  }]
}
```

**Access Denied:**
```json
{
  "resourceType": "OperationOutcome",
  "issue": [{
    "severity": "error",
    "code": "forbidden",
    "diagnostics": "Access denied"
  }]
}
```

## Implementation Details

### Queue Processing
- Jobs processed asynchronously via BullMQ
- Streaming approach prevents memory issues
- Progress tracking available during processing

### Storage
- Export files stored on IPFS (InterPlanetary File System)
- Decentralized, content-addressed storage
- Files accessible via IPFS gateways

### Format
- NDJSON (Newline Delimited JSON)
- One complete FHIR resource per line
- Efficient for large datasets
- Easy to stream and process

## Example: Complete Export Flow

```bash
# 1. Initiate export
curl -X GET "http://localhost:3000/fhir/r4/Patient/\$export?_type=Patient,DocumentReference" \
  -H "Authorization: Bearer eyJhbGc..."

# Response: 202 Accepted
# Content-Location: /fhir/r4/$export-status/550e8400-e29b-41d4-a716-446655440000

# 2. Poll for status (repeat until completed)
curl -X GET "http://localhost:3000/fhir/r4/\$export-status/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer eyJhbGc..."

# Response: {"status": "in_progress", "progress": 50, ...}

# 3. Get download manifest (when completed)
curl -X GET "http://localhost:3000/fhir/r4/\$export-status/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer eyJhbGc..."

# Response: {"transactionTime": "...", "output": [...]}

# 4. Download files from IPFS
curl "https://ipfs.io/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco" \
  -o patient-export.ndjson
```

## Best Practices

1. **Polling Interval**: Poll status endpoint every 5-10 seconds
2. **Timeout**: Set reasonable timeout (e.g., 30 minutes for large exports)
3. **Download Promptly**: Download files before 24-hour expiration
4. **Error Handling**: Implement retry logic for transient failures
5. **Resource Types**: Request only needed resource types to reduce export size
6. **Storage**: Store downloaded files securely with appropriate access controls

## Compliance

This implementation follows:
- FHIR R4 specification
- FHIR Bulk Data Access IG (Implementation Guide)
- HL7 FHIR standards for interoperability
