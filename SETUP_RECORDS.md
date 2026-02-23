# Quick Setup Guide - Records Module

## Prerequisites

- Node.js v18+
- PostgreSQL 12+
- IPFS node (local or remote)
- Stellar testnet account

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

This will install:
- `@stellar/stellar-sdk` - Stellar blockchain SDK
- `ipfs-http-client` - IPFS HTTP client

### 2. Set Up IPFS Node

**Option A: Docker (Recommended)**
```bash
docker run -d --name ipfs_host \
  -p 5001:5001 \
  -p 8080:8080 \
  ipfs/go-ipfs:latest
```

**Option B: Local Installation**
```bash
# Download from https://docs.ipfs.tech/install/
# Then start the daemon
ipfs daemon
```

Verify IPFS is running:
```bash
curl http://localhost:5001/api/v0/version
```

### 3. Set Up Stellar Testnet Account

1. Go to https://laboratory.stellar.org/#account-creator
2. Click "Generate keypair"
3. Save your public and secret keys
4. Click "Get test network lumens" to fund your account

### 4. Deploy Soroban Contract (Optional for Testing)

```bash
# Install Stellar CLI
cargo install --locked stellar-cli

# Create a simple anchor contract
stellar contract deploy \
  --wasm path/to/contract.wasm \
  --source YOUR_SECRET_KEY \
  --network testnet
```

Sample Soroban contract:
```rust
#[contract]
pub struct RecordAnchor;

#[contractimpl]
impl RecordAnchor {
    pub fn anchor_record(
        env: Env,
        patient_id: String,
        cid: String
    ) -> Result<(), Error> {
        // Store CID mapping
        env.storage().instance().set(&patient_id, &cid);
        Ok(())
    }
}
```

### 5. Configure Environment Variables

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Update the following variables:
```env
# IPFS
IPFS_HOST=localhost
IPFS_PORT=5001
IPFS_PROTOCOL=http

# Stellar
STELLAR_NETWORK=testnet
STELLAR_SECRET_KEY=SXXX...  # Your secret key from step 3
STELLAR_CONTRACT_ID=CXXX...  # Your contract ID from step 4
```

### 6. Run Database Migrations

```bash
npm run migration:run
```

### 7. Start the Application

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

### 8. Test the Endpoint

```bash
# Create a test encrypted file
echo "encrypted-medical-data" > test-record.bin

# Upload the record
curl -X POST http://localhost:3000/records \
  -F "patientId=patient-123" \
  -F "recordType=MEDICAL_REPORT" \
  -F "description=Test upload" \
  -F "file=@test-record.bin"
```

Expected response:
```json
{
  "recordId": "550e8400-e29b-41d4-a716-446655440000",
  "cid": "QmXxx...",
  "stellarTxHash": "abc123..."
}
```

## Troubleshooting

### IPFS Connection Error
```
Error: IPFS upload failed: connect ECONNREFUSED
```
**Solution**: Ensure IPFS daemon is running on port 5001

### Stellar Transaction Failed
```
Error: Stellar anchoring failed: Account not found
```
**Solution**: Ensure your Stellar account is funded with testnet lumens

### File Size Error
```
Error: File too large
```
**Solution**: Ensure file is under 10MB limit

## Running Tests

```bash
# Unit tests
npm run test

# Integration tests (requires IPFS and Stellar testnet)
npm run test:e2e
```

## Next Steps

1. Implement authentication guards
2. Add record retrieval endpoints
3. Implement access control with patient consent
4. Set up production IPFS pinning service
5. Configure production Stellar network

## Support

For issues or questions, please refer to:
- [IPFS Documentation](https://docs.ipfs.tech/)
- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/)
