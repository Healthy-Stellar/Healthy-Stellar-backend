# Key Management Architecture

## Overview

The Key Management Module provides secure encryption key management for patient records using AWS KMS (Key Management Service) as the primary backend with local fallback for development environments. This implementation ensures HIPAA compliance and supports GDPR data erasure requirements.

## Architecture

### Key Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS KMS Customer Master Key (CMK)        │
│                         (Per Tenant)                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Encrypts/Decrypts
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Data Encryption Keys (DEK)                │
│                    (Per Patient Record)                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Encrypts/Decrypts
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Patient Health Records                  │
│                      (Encrypted Data)                      │
└─────────────────────────────────────────────────────────────┘
```

### Components

1. **KeyManagementService Interface**: Defines the contract for key operations
2. **AwsKmsService**: Primary implementation using AWS KMS
3. **Local Fallback**: Software-based encryption for development
4. **Circuit Breaker**: Resilience pattern for KMS API calls
5. **Audit Trail**: Comprehensive logging of all key operations

## Key Operations

### 1. Generate Data Key

Generates a new AES-256 data encryption key for a patient record.

```typescript
const dataKey = await keyManagementService.generateDataKey('patient-123');
// Returns: { encryptedKey: Buffer, plainKey: Buffer }
```

**Flow:**
1. Resolve tenant from patient context
2. Retrieve tenant's CMK ARN
3. Call KMS GenerateDataKey with encryption context
4. Return encrypted and plain key materials
5. Log operation for audit trail

### 2. Decrypt Data Key

Decrypts an encrypted data key to access patient records.

```typescript
const plainKey = await keyManagementService.decryptDataKey(encryptedKey, 'patient-123');
// Returns: Buffer (32-byte AES-256 key)
```

**Flow:**
1. Resolve tenant and encryption context
2. Call KMS Decrypt with encrypted key
3. Return plain key material
4. Log operation for audit trail

### 3. Rotate Patient Key

Re-encrypts all patient data keys under a new CMK version.

```typescript
await keyManagementService.rotatePatientKey('patient-123');
```

**Implementation Notes:**
- Scheduled operation for key rotation policies
- Maintains backward compatibility during transition
- Atomic operation to prevent data loss

### 4. Destroy Patient Keys

Irreversibly destroys all encryption keys for a patient (GDPR erasure).

```typescript
await keyManagementService.destroyPatientKeys('patient-123');
```

**GDPR Compliance:**
- Marks keys for secure deletion
- Schedules cryptographic erasure
- Maintains audit trail of destruction

## Configuration

### Environment Variables

```bash
# KMS Configuration
KMS_ENABLED=true
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Local Development Fallback
LOCAL_KEK=your-32-character-key-encryption-key
```

### Tenant Configuration

Each tenant must have a dedicated CMK configured:

```sql
UPDATE tenants 
SET kms_cmk_arn = 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012'
WHERE id = 'tenant-id';
```

## Security Features

### 1. Encryption Context

All KMS operations include encryption context for additional security:

```typescript
{
  patientId: 'patient-123',
  tenantId: 'tenant-456'
}
```

### 2. Circuit Breaker Protection

KMS API calls are protected with circuit breaker pattern:
- **Failure Threshold**: 5 consecutive failures
- **Timeout**: 30 seconds
- **Recovery**: Exponential backoff with jitter

### 3. Audit Trail

Every key operation is logged with:
- Operation type (GENERATE_DATA_KEY, DECRYPT_DATA_KEY, etc.)
- Patient ID and tenant context
- Timestamp and actor information
- Success/failure status

### 4. Local Development Security

Local fallback uses AES-256-CBC encryption:
- 32-byte key encryption key (KEK)
- Random IV for each encryption
- Secure key derivation

## Deployment

### AWS KMS Setup

1. **Create Customer Master Key (CMK)**:
```bash
aws kms create-key \
  --description "Healthcare tenant CMK" \
  --key-usage ENCRYPT_DECRYPT \
  --key-spec SYMMETRIC_DEFAULT
```

2. **Configure Key Policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::ACCOUNT:role/HealthcareAppRole"},
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "kms:DescribeKey"
      ],
      "Resource": "*"
    }
  ]
}
```

### IAM Permissions

Required IAM permissions for the application:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:GenerateDataKey",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:*:*:key/*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "kms.us-east-1.amazonaws.com"
        }
      }
    }
  ]
}
```

## Monitoring and Alerting

### Metrics

The service exposes Prometheus metrics:
- `medchain_key_operations_total`: Counter of key operations by type
- `medchain_key_operation_duration_seconds`: Histogram of operation latencies
- `medchain_circuit_breaker_state`: Circuit breaker state gauge

### Alerts

Recommended alerts:
- Circuit breaker open for > 5 minutes
- Key operation failure rate > 1%
- KMS API latency > 5 seconds

## Testing

### Unit Tests

```bash
npm run test src/key-management/__tests__/aws-kms.service.spec.ts
```

### Integration Tests

```bash
# Requires AWS credentials
KMS_ENABLED=true npm run test:e2e src/key-management/__tests__/key-management.integration.spec.ts
```

### Load Testing

Key management operations should be tested under load:
- 1000 concurrent key generations
- 10,000 key decryptions per minute
- Circuit breaker behavior under failure conditions

## Compliance

### HIPAA Requirements

- ✅ Encryption at rest using FIPS 140-2 Level 3 HSMs
- ✅ Audit trail of all key access
- ✅ Role-based access controls
- ✅ Secure key lifecycle management

### GDPR Requirements

- ✅ Right to erasure (cryptographic deletion)
- ✅ Data minimization (per-record keys)
- ✅ Audit trail for compliance reporting
- ✅ Secure key destruction

## Troubleshooting

### Common Issues

1. **KMS Access Denied**
   - Verify IAM permissions
   - Check CMK key policy
   - Validate encryption context

2. **Circuit Breaker Open**
   - Check AWS service health
   - Verify network connectivity
   - Review error logs for root cause

3. **Local Mode Not Working**
   - Verify LOCAL_KEK configuration
   - Check key length (must be 32 characters)
   - Validate encryption/decryption flow

### Debug Commands

```bash
# Check KMS connectivity
aws kms describe-key --key-id alias/healthcare-cmk

# Verify circuit breaker status
curl http://localhost:3000/health/circuit-breakers

# Review audit logs
curl http://localhost:3000/admin/audit-logs?operation=GENERATE_DATA_KEY
```

## Future Enhancements

1. **Multi-Region Support**: Cross-region key replication
2. **Hardware Security Modules**: Direct HSM integration
3. **Key Escrow**: Regulatory compliance features
4. **Automated Key Rotation**: Policy-driven rotation schedules
5. **Quantum-Resistant Algorithms**: Post-quantum cryptography support