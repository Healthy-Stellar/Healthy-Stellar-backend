# Records Module - IPFS & Stellar Integration

## Overview

This module implements the core record upload flow where encrypted medical records are uploaded to IPFS and anchored on the Stellar blockchain via Soroban smart contracts.

## Features

- ✅ Accepts encrypted record blobs via multipart/form-data
- ✅ Uploads to IPFS and returns CID
- ✅ Anchors CID on Stellar blockchain via Soroban contract
- ✅ Stores metadata in PostgreSQL
- ✅ Enforces 10MB file size limit
- ✅ Full integration test coverage

## Architecture

```
Client (Encrypted Data) 
    ↓
POST /records (NestJS Controller)
    ↓
RecordsService
    ↓
    ├─→ IpfsService.upload() → IPFS CID
    ├─→ StellarService.anchorCid() → Stellar TxHash
    └─→ PostgreSQL (Record Entity)
```

## API Endpoint

### POST /records

Upload an encrypted medical record.

**Request:**
- Content-Type: `multipart/form-data`
- Fields:
  - `patientId` (string, required): Patient identifier
  - `recordType` (enum, required): Type of record (MEDICAL_REPORT, LAB_RESULT, PRESCRIPTION, IMAGING, CONSULTATION)
  - `description` (string, optional): Record description
  - `file` (binary, required): Encrypted record blob (max 10MB)

**Response:**
```json
{
  "recordId": "uuid",
  "cid": "QmXxx...",
  "stellarTxHash": "abc123..."
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/records \
  -F "patientId=patient-123" \
  -F "recordType=MEDICAL_REPORT" \
  -F "description=Annual checkup" \
  -F "file=@encrypted-record.bin"
```

## Database Schema

### Record Entity

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| patientId | String | Patient identifier |
| cid | String | IPFS Content Identifier |
| stellarTxHash | String | Stellar transaction hash |
| recordType | Enum | Type of medical record |
| description | String | Optional description |
| createdAt | Timestamp | Creation timestamp |

## Environment Variables

Add these to your `.env` file:

```env
# IPFS Configuration
IPFS_HOST=localhost
IPFS_PORT=5001
IPFS_PROTOCOL=http

# Stellar Configuration
STELLAR_NETWORK=testnet
STELLAR_SECRET_KEY=your_stellar_secret_key
STELLAR_CONTRACT_ID=your_contract_id
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up IPFS node:
```bash
# Using Docker
docker run -d --name ipfs_host \
  -p 5001:5001 \
  -p 8080:8080 \
  ipfs/go-ipfs:latest

# Or install locally
# https://docs.ipfs.tech/install/
```

3. Configure Stellar:
   - Create a Stellar testnet account: https://laboratory.stellar.org/#account-creator
   - Deploy Soroban contract for record anchoring
   - Update `.env` with credentials

4. Run migrations:
```bash
npm run migration:run
```

## Testing

### Unit Tests
```bash
npm run test
```

### Integration Tests
```bash
npm run test:e2e
```

The integration test covers:
- Full upload → IPFS → Stellar flow
- File size validation (10MB limit)
- Missing file validation
- CID format validation

## Soroban Contract Interface

The Stellar service expects a Soroban contract with the following method:

```rust
pub fn anchor_record(
    env: Env,
    patient_id: String,
    cid: String
) -> Result<(), Error>
```

## Security Considerations

1. **Client-Side Encryption**: Records MUST be encrypted client-side before upload
2. **Access Control**: Implement authentication guards on the endpoint
3. **Rate Limiting**: Apply throttling to prevent abuse
4. **Audit Logging**: Log all record uploads for compliance
5. **Key Management**: Secure Stellar secret keys using environment variables or secret managers

## Error Handling

| Error | Status | Description |
|-------|--------|-------------|
| Missing file | 400 | No file attached to request |
| File too large | 413 | File exceeds 10MB limit |
| IPFS failure | 500 | IPFS upload failed |
| Stellar failure | 500 | Blockchain anchoring failed |

## Future Enhancements

- [ ] Add record retrieval endpoint
- [ ] Implement access control with patient consent
- [ ] Add batch upload support
- [ ] Implement IPFS pinning service integration
- [ ] Add record versioning
- [ ] Implement encryption key rotation

## License

MIT
