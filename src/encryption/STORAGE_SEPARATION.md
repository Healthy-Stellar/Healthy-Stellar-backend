# Storage Separation Requirements

## Overview

This document defines the critical storage separation requirements for the envelope encryption system. Proper separation of encrypted components across different storage systems is essential for security, compliance, and the overall integrity of the encryption architecture.

## Storage Architecture

The envelope encryption system distributes encrypted data components across three distinct storage layers:

1. **IPFS (InterPlanetary File System)** - Distributed content-addressable storage
2. **PostgreSQL Database** - Relational database for metadata and key material
3. **Stellar Blockchain** - Immutable ledger for record references

## Component Storage Distribution

### Components Stored on IPFS

**Ciphertext Only**

- The encrypted medical record payload (ciphertext) is stored exclusively on IPFS
- IPFS returns a Content Identifier (CID) that uniquely identifies the encrypted content
- The ciphertext alone is cryptographically useless without the corresponding decryption components

**Rationale:**
- IPFS provides distributed, content-addressed storage ideal for large binary data
- Storing only ciphertext on IPFS ensures that even if IPFS data is compromised, the plaintext cannot be recovered without access to the encrypted DEK and other components stored separately in PostgreSQL

### Components Stored in PostgreSQL

**Encrypted DEK, IV, Authentication Tag, and Metadata**

The following components are stored in the PostgreSQL database:

- `encrypted_dek` (BYTEA) - The Data Encryption Key encrypted with the patient's KEK
- `iv` (BYTEA) - The 12-byte Initialization Vector used for AES-256-GCM encryption
- `auth_tag` (BYTEA) - The 16-byte authentication tag for integrity verification
- `dek_version` (VARCHAR) - The version identifier for the DEK encryption scheme
- `ipfs_cid` (VARCHAR) - The Content Identifier linking to the ciphertext on IPFS
- `patient_id` (VARCHAR) - The patient identifier for access control
- Timestamps and other metadata

**Rationale:**
- PostgreSQL provides ACID guarantees, access control, and query capabilities
- Storing the encrypted DEK in PostgreSQL ensures it remains private and is never exposed on public storage systems
- The encrypted DEK is the critical component that, when combined with the patient's KEK, allows decryption of the medical record
- Keeping the encrypted DEK separate from the ciphertext provides defense in depth

### Components Never Stored on IPFS or Blockchain

**Critical Security Requirement:**

The following components MUST NEVER be stored on IPFS or the Stellar blockchain:

- **Encrypted DEK** - Must only exist in PostgreSQL
- **Plaintext DEK** - Must never be persisted anywhere (exists only in memory during encryption/decryption)
- **Patient KEK** - Must only exist in the Key Management Service (KMS)
- **Plaintext medical record data** - Must never be stored unencrypted

**Rationale:**
- IPFS and blockchain are public or semi-public distributed systems
- Storing encrypted DEKs on these systems would expose key material to potential attackers
- Even though the DEK is encrypted, storing it publicly increases the attack surface
- Compliance requirements (HIPAA, GDPR) mandate that key material remain in controlled, private storage

## Storage Separation Validation

### Requirements Validation

This storage architecture satisfies the following requirements:

**Requirement 6.1:** The Encryption_Service SHALL provide the encrypted Data_Encryption_Key to the calling service for storage in the PostgreSQL_Database

✅ **Validated:** The `encryptRecord` method returns an `EncryptedRecord` object containing the `encryptedDek` field, which the calling service stores in PostgreSQL.

**Requirement 6.2:** The Encryption_Service SHALL ensure the encrypted Data_Encryption_Key is stored alongside the IPFS CID in the PostgreSQL_Database

✅ **Validated:** The database schema includes both `encrypted_dek` and `ipfs_cid` columns in the `medical_records` table, ensuring they are stored together.

**Requirement 6.4:** The Encryption_Service SHALL ensure the encrypted Data_Encryption_Key is never uploaded to IPFS

✅ **Validated:** The `EncryptedRecord` structure separates the `ciphertext` (for IPFS) from the `encryptedDek` (for PostgreSQL). The calling service is responsible for storing only the ciphertext on IPFS.

**Requirement 6.5:** The Encryption_Service SHALL ensure the encrypted Data_Encryption_Key is never stored on the Stellar blockchain

✅ **Validated:** The blockchain only stores references (CIDs) to IPFS content, not the encrypted DEK or any other encryption components.

## Data Flow Diagrams

### Encryption and Storage Flow

```
Medical Record (Plaintext)
         |
         v
[Generate DEK] -----> DEK (32 bytes, in memory)
         |
         v
[Encrypt with DEK] --> Ciphertext
         |                |
         v                v
[Wrap DEK with KEK]    Store on IPFS
         |                |
         v                v
   Encrypted DEK      Returns CID
         |                |
         |                |
         +-------+--------+
                 |
                 v
         Store in PostgreSQL:
         - encrypted_dek
         - iv
         - auth_tag
         - dek_version
         - ipfs_cid
         - patient_id
```

### Decryption and Retrieval Flow

```
Retrieve from PostgreSQL:
- encrypted_dek
- iv
- auth_tag
- ipfs_cid
         |
         v
[Unwrap DEK with KEK] --> DEK (in memory)
         |
         v
Retrieve ciphertext from IPFS using CID
         |
         v
[Decrypt with DEK, IV, auth_tag]
         |
         v
Medical Record (Plaintext)
         |
         v
[Clear DEK from memory]
```

## Security Implications

### Defense in Depth

The storage separation provides multiple layers of security:

1. **Ciphertext Isolation:** Even if IPFS is compromised, attackers only obtain useless ciphertext
2. **Key Material Protection:** Encrypted DEKs in PostgreSQL are protected by database access controls
3. **KEK Isolation:** Patient KEKs never leave the KMS, providing the ultimate protection layer
4. **Distributed Trust:** No single storage system contains all components needed for decryption

### Attack Scenarios and Mitigations

**Scenario 1: IPFS Compromise**
- Attacker gains access to IPFS and downloads all ciphertext
- **Mitigation:** Without the encrypted DEKs from PostgreSQL, the ciphertext cannot be decrypted

**Scenario 2: PostgreSQL Compromise**
- Attacker gains access to PostgreSQL and extracts encrypted DEKs
- **Mitigation:** Without the patient KEKs from the KMS, the encrypted DEKs cannot be unwrapped. Without the ciphertext from IPFS, there's nothing to decrypt even if DEKs were compromised.

**Scenario 3: Combined IPFS + PostgreSQL Compromise**
- Attacker gains access to both IPFS and PostgreSQL
- **Mitigation:** Without the patient KEKs from the KMS, the encrypted DEKs cannot be unwrapped, and decryption is still impossible

**Scenario 4: KMS Compromise**
- Attacker gains access to the KMS and patient KEKs
- **Mitigation:** The attacker still needs both the encrypted DEKs from PostgreSQL and the ciphertext from IPFS to decrypt records. Access controls and audit logging on PostgreSQL and IPFS provide additional barriers.

## Compliance Considerations

### HIPAA Compliance

The storage separation architecture supports HIPAA compliance by:

- Ensuring Protected Health Information (PHI) is encrypted at rest
- Maintaining audit trails in PostgreSQL for access to encrypted DEKs
- Separating key material from encrypted data
- Implementing access controls at multiple layers

### GDPR Compliance

The architecture supports GDPR requirements by:

- Enabling patient-specific encryption (data minimization)
- Supporting the right to erasure (delete KEK to make data unrecoverable)
- Maintaining data integrity through authentication tags
- Providing audit trails for data access

## Implementation Guidelines

### For Developers

When implementing services that use the EncryptionService:

1. **After Encryption:**
   - Store `encryptedRecord.ciphertext` on IPFS
   - Store `encryptedRecord.encryptedDek`, `encryptedRecord.iv`, `encryptedRecord.authTag`, `encryptedRecord.dekVersion`, and the IPFS CID in PostgreSQL
   - **Never** store the encrypted DEK on IPFS or blockchain

2. **Before Decryption:**
   - Retrieve the encrypted DEK, IV, auth tag, and DEK version from PostgreSQL
   - Retrieve the ciphertext from IPFS using the stored CID
   - Construct the `EncryptedRecord` object with all components
   - Pass to `decryptRecord` method

3. **Error Handling:**
   - If components are missing from PostgreSQL, throw a `ValidationError`
   - If the IPFS CID is invalid or content is unavailable, handle appropriately
   - Never log or expose sensitive components (DEKs, KEKs, plaintext)

### For Auditors

To verify storage separation compliance:

1. **Inspect IPFS Storage:**
   - Verify only ciphertext is stored (no encrypted DEKs, IVs, or auth tags)
   - Verify ciphertext is cryptographically random (no patterns)

2. **Inspect PostgreSQL Database:**
   - Verify `encrypted_dek`, `iv`, `auth_tag`, and `dek_version` columns exist
   - Verify encrypted DEKs are present for all records
   - Verify no plaintext DEKs or KEKs are stored

3. **Inspect Blockchain:**
   - Verify only CIDs and metadata are stored (no encrypted DEKs or ciphertext)

4. **Review Code:**
   - Verify EncryptionService never writes encrypted DEKs to IPFS
   - Verify calling services correctly distribute components across storage systems

## Database Schema Reference

### medical_records Table

```sql
CREATE TABLE medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id VARCHAR(255) NOT NULL,
  ipfs_cid VARCHAR(255) NOT NULL,
  encrypted_dek BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  dek_version VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_patient_id (patient_id),
  INDEX idx_ipfs_cid (ipfs_cid)
);
```

**Key Points:**
- `encrypted_dek`, `iv`, and `auth_tag` use BYTEA type for binary data
- `ipfs_cid` links to the ciphertext stored on IPFS
- `patient_id` enables patient-specific access control
- Indexes support efficient queries by patient and CID

## Conclusion

The storage separation architecture is a critical security feature of the envelope encryption system. By distributing encrypted components across IPFS, PostgreSQL, and maintaining KEKs in the KMS, the system achieves defense in depth and compliance with healthcare data protection regulations.

**Key Takeaways:**

- ✅ Ciphertext goes to IPFS
- ✅ Encrypted DEK, IV, auth tag, and DEK version go to PostgreSQL
- ✅ Encrypted DEK never goes to IPFS or blockchain
- ✅ KEKs never leave the KMS
- ✅ No single storage system contains all components needed for decryption

This separation ensures that compromise of any single storage system does not result in exposure of plaintext medical records.
