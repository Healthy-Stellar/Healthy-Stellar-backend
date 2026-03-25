# Implementation Plan: Envelope Encryption for Medical Records

## Overview

This implementation plan creates an envelope encryption system for medical records in a NestJS application. The system uses a two-tier key hierarchy where each medical record is encrypted with a unique Data Encryption Key (DEK), and each DEK is encrypted with a patient-specific Key Encryption Key (KEK). The implementation includes comprehensive error handling, property-based testing, and performance validation.

## Tasks

- [x] 1. Set up project structure and dependencies
  - Create encryption module directory structure
  - Install required dependencies: `@nestjs/common`, `fast-check`, `@types/fast-check`
  - Set up TypeScript configuration for the encryption module
  - _Requirements: 1.5_

- [ ] 2. Define core interfaces and error classes
  - [x] 2.1 Create EncryptedRecord interface
    - Define interface with iv, ciphertext, authTag, encryptedDek, and dekVersion fields
    - All Buffer fields should be typed as Buffer
    - dekVersion should be typed as string
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [x] 2.2 Create error class hierarchy
    - Implement EncryptionServiceError base class
    - Implement EncryptionError, DecryptionError, AuthenticationError, KeyManagementError, and ValidationError classes
    - Each error class should extend the appropriate parent and set the correct name property
    - _Requirements: 7.4, 11.1, 11.2_

- [ ] 3. Implement KeyManagementService
  - [x] 3.1 Create KeyManagementService class with dependency injection
    - Implement as NestJS injectable service
    - Create in-memory KEK storage for patient-specific keys (for development/testing)
    - Add method to initialize KEKs for test patients
    - _Requirements: 8.3, 13.5_
  
  - [x] 3.2 Implement wrapDek method
    - Accept plaintext DEK Buffer and patientId string as parameters
    - Retrieve patient's KEK from storage
    - Generate unique 12-byte IV for wrapping operation
    - Encrypt DEK using AES-256-GCM with patient's KEK
    - Return Buffer containing IV + encrypted DEK + auth tag
    - Throw KeyManagementError if KEK not found
    - _Requirements: 4.1, 4.2, 4.3, 13.1, 13.3_
  
  - [x] 3.3 Implement unwrapDek method
    - Accept encrypted DEK Buffer and patientId string as parameters
    - Retrieve patient's KEK from storage
    - Extract IV, encrypted DEK, and auth tag from input Buffer
    - Decrypt DEK using AES-256-GCM with patient's KEK
    - Verify authentication tag
    - Return plaintext DEK as Buffer
    - Throw KeyManagementError if decryption fails
    - _Requirements: 7.1, 13.2, 13.4_
  
  - [x] 3.4 Implement getDekVersion method
    - Accept patientId string as parameter
    - Return current DEK version identifier as string (e.g., "v1")
    - _Requirements: 14.3_
  
  - [ ]* 3.5 Write property test for KeyManagementService
    - **Property 9: KMS Wrap/Unwrap Round-Trip**
    - **Validates: Requirements 13.4**
    - Generate random DEKs (32 bytes) and patient IDs
    - Verify wrap then unwrap returns original DEK
    - Run 100 iterations

- [ ] 4. Implement EncryptionService core functionality
  - [x] 4.1 Create EncryptionService class with KeyManagementService injection
    - Implement as NestJS injectable service
    - Inject KeyManagementService via constructor
    - _Requirements: 1.5, 8.1_
  
  - [x] 4.2 Implement encryptRecord method
    - Accept payload Buffer and patientId string as parameters
    - Generate 32-byte DEK using crypto.randomBytes
    - Generate 12-byte IV using crypto.randomBytes
    - Create AES-256-GCM cipher with DEK and IV
    - Encrypt payload and extract authentication tag
    - Call kms.wrapDek to encrypt the DEK
    - Call kms.getDekVersion to get version identifier
    - Assemble EncryptedRecord with all components
    - Clear plaintext DEK from memory using Buffer.fill(0)
    - Return EncryptedRecord
    - Throw EncryptionError on failure
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.4, 5.6, 10.1, 10.2, 14.2_
  
  - [x] 4.3 Implement decryptRecord method
    - Accept EncryptedRecord and patientId string as parameters
    - Validate EncryptedRecord structure (all fields present and non-empty)
    - Call kms.unwrapDek to decrypt the DEK
    - Create AES-256-GCM decipher with DEK and IV
    - Set authentication tag on decipher
    - Decrypt ciphertext
    - Clear plaintext DEK from memory using Buffer.fill(0)
    - Return plaintext payload as Buffer
    - Throw AuthenticationError if auth tag verification fails
    - Throw DecryptionError on other failures
    - Throw ValidationError if EncryptedRecord is malformed
    - _Requirements: 1.2, 1.4, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 11.1, 11.2, 11.4_
  
  - [ ]* 4.4 Write property test for encryption/decryption round-trip
    - **Property 1: Encryption/Decryption Round-Trip**
    - **Validates: Requirements 3.4, 7.2, 7.3, 7.5**
    - Generate random payloads (1 byte to 10KB) and patient IDs
    - Verify encrypt then decrypt returns original payload
    - Run 100 iterations
  
  - [ ]* 4.5 Write property test for unique DEKs
    - **Property 2: Unique Data Encryption Keys**
    - **Validates: Requirements 2.2**
    - Generate 50 encrypted records with same payload and patient ID
    - Extract encrypted DEKs from each record
    - Verify all encrypted DEKs are unique (no duplicates)
    - Run 100 iterations
  
  - [ ]* 4.6 Write property test for unique IVs
    - **Property 3: Unique Initialization Vectors**
    - **Validates: Requirements 3.5, 10.2, 10.3**
    - Generate 50 encrypted records with same payload and patient ID
    - Extract IVs from each record
    - Verify all IVs are unique (no duplicates)
    - Run 100 iterations

- [ ] 5. Implement validation and security checks
  - [x] 5.1 Add EncryptedRecord structure validation
    - Validate all required fields are present
    - Validate all Buffer fields are non-empty
    - Validate dekVersion is non-empty string
    - Throw ValidationError if validation fails
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 5.2 Add cryptographic parameter validation
    - Verify DEK is exactly 32 bytes after generation
    - Verify IV is exactly 12 bytes after generation
    - Verify auth tag is 16 bytes after encryption
    - Throw EncryptionError if sizes are incorrect
    - _Requirements: 2.1, 3.2, 10.1_
  
  - [ ]* 5.3 Write property test for structure completeness
    - **Property 4: Encrypted Record Structure Completeness**
    - **Validates: Requirements 4.4, 5.6, 10.4, 14.1**
    - Generate random payloads and patient IDs
    - Verify all fields present and non-empty in encrypted record
    - Run 100 iterations
  
  - [ ]* 5.4 Write property test for cryptographic parameter sizes
    - **Property 5: Cryptographic Parameter Sizes**
    - **Validates: Requirements 2.1, 3.2, 10.1**
    - Generate random payloads and patient IDs
    - Verify DEK is 32 bytes and IV is 12 bytes
    - Run 100 iterations

- [ ] 6. Implement error handling and security features
  - [x] 6.1 Add authentication tag verification error handling
    - Detect auth tag verification failures during decryption
    - Throw AuthenticationError with descriptive message
    - Log security event for audit trail
    - Ensure error message doesn't leak sensitive data
    - _Requirements: 7.4, 11.1, 11.3, 11.4_
  
  - [x] 6.2 Add encrypted DEK error handling
    - Detect invalid or corrupted encrypted DEK
    - Throw KeyManagementError with descriptive message
    - Log security event for audit trail
    - _Requirements: 11.2, 11.3_
  
  - [ ]* 6.3 Write property test for authentication tag verification
    - **Property 6: Authentication Tag Verification**
    - **Validates: Requirements 7.4, 11.1**
    - Generate random encrypted records
    - Corrupt ciphertext or auth tag
    - Verify decryption throws AuthenticationError
    - Run 100 iterations
  
  - [ ]* 6.4 Write property test for invalid encrypted DEK handling
    - **Property 7: Invalid Encrypted DEK Handling**
    - **Validates: Requirements 11.2**
    - Generate random encrypted records
    - Corrupt encrypted DEK field
    - Verify decryption throws KeyManagementError
    - Run 100 iterations
  
  - [ ]* 6.5 Write property test for DEK version population
    - **Property 8: DEK Version Population**
    - **Validates: Requirements 14.2**
    - Generate random payloads and patient IDs
    - Verify dekVersion field is non-empty string
    - Run 100 iterations

- [ ] 7. Create EncryptionModule with proper encapsulation
  - [x] 7.1 Define NestJS module with providers and exports
    - Declare EncryptionService and KeyManagementService as providers
    - Export only EncryptionService (not KeyManagementService)
    - Configure dependency injection for proper encapsulation
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ]* 7.2 Write unit test for module encapsulation
    - Verify KeyManagementService is not exported
    - Verify EncryptionService can be imported by other modules
    - Verify KeyManagementService cannot be directly imported
    - _Requirements: 8.2, 8.4_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Create database schema and integration
  - [x] 9.1 Create PostgreSQL migration for medical_records table
    - Define table with id, patient_id, ipfs_cid, encrypted_dek, iv, auth_tag, dek_version, created_at, updated_at
    - Add indexes on patient_id and ipfs_cid
    - Use BYTEA type for encrypted_dek, iv, and auth_tag
    - _Requirements: 6.1, 6.2_
  
  - [x] 9.2 Create PostgreSQL migration for patient_keks table
    - Define table with patient_id, kek_id, kek_version, created_at, rotated_at
    - Add index on kek_id
    - _Requirements: 13.5_
  
  - [ ]* 9.3 Write integration test for database storage
    - Test storing encrypted record metadata in PostgreSQL
    - Verify encrypted DEK is stored correctly
    - Verify encrypted DEK is never null or empty
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 10. Add unit tests for specific scenarios
  - [ ]* 10.1 Write unit test for small payload encryption
    - Test encrypting payload < 1KB
    - Verify successful round-trip
    - _Requirements: 12.1_
  
  - [ ]* 10.2 Write unit test for medium payload encryption
    - Test encrypting payload ~1MB
    - Verify successful round-trip
    - _Requirements: 12.1_
  
  - [ ]* 10.3 Write unit test for large payload encryption
    - Test encrypting payload ~10MB
    - Verify successful round-trip
    - _Requirements: 12.1_
  
  - [ ]* 10.4 Write unit test for corrupted ciphertext
    - Encrypt a payload, corrupt the ciphertext
    - Verify decryption throws AuthenticationError
    - _Requirements: 12.2_
  
  - [ ]* 10.5 Write unit test for corrupted auth tag
    - Encrypt a payload, corrupt the auth tag
    - Verify decryption throws AuthenticationError
    - _Requirements: 12.2_
  
  - [ ]* 10.6 Write unit test for invalid encrypted DEK
    - Encrypt a payload, corrupt the encrypted DEK
    - Verify decryption throws KeyManagementError
    - _Requirements: 12.3_
  
  - [ ]* 10.7 Write unit test for wrong patient ID
    - Encrypt with one patient ID, decrypt with different patient ID
    - Verify decryption throws KeyManagementError
    - _Requirements: 11.2_
  
  - [ ]* 10.8 Write unit test for empty payload edge case
    - Test encrypting empty Buffer
    - Verify behavior is well-defined
    - _Requirements: 12.1_
  
  - [ ]* 10.9 Write unit test for missing fields in encrypted record
    - Create malformed encrypted record with missing fields
    - Verify decryption throws ValidationError
    - _Requirements: 11.1_
  
  - [ ]* 10.10 Write unit test for DEK uniqueness
    - Generate multiple encrypted records
    - Verify all DEKs are unique
    - _Requirements: 12.4_
  
  - [ ]* 10.11 Write unit test for IV uniqueness
    - Generate multiple encrypted records
    - Verify all IVs are unique
    - _Requirements: 12.5_
  
  - [ ]* 10.12 Write unit test for code coverage validation
    - Run coverage report
    - Verify ≥90% line coverage for EncryptionService
    - _Requirements: 12.6_

- [ ] 11. Add performance testing
  - [ ]* 11.1 Write performance test for 10MB encryption
    - Measure time to encrypt 10MB payload
    - Verify encryption completes in <250ms
    - Log performance metrics
    - _Requirements: 9.1, 9.2_
  
  - [ ]* 11.2 Write performance test for 10MB decryption
    - Measure time to decrypt 10MB payload
    - Verify decryption completes in <250ms
    - Log performance metrics
    - _Requirements: 9.1, 9.2_
  
  - [ ]* 11.3 Write performance test for round-trip
    - Measure time for encrypt + decrypt of 10MB payload
    - Verify total time is <500ms
    - Log performance metrics
    - If performance requirement not met, log detailed metrics
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 12. Add security and compliance features
  - [x] 12.1 Implement memory clearing for sensitive data
    - Use Buffer.fill(0) to clear plaintext DEKs after use
    - Clear DEKs in both success and error paths
    - Add try-finally blocks to ensure cleanup
    - _Requirements: 2.4, 7.6_
  
  - [x] 12.2 Add security audit logging
    - Log failed decryption attempts with context
    - Log authentication tag verification failures
    - Ensure logs don't contain sensitive data (keys, plaintext)
    - _Requirements: 11.3, 11.4_
  
  - [x] 12.3 Verify storage separation requirements
    - Document that ciphertext goes to IPFS
    - Document that encrypted DEK, IV, auth tag go to PostgreSQL
    - Document that encrypted DEK never goes to IPFS or blockchain
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use fast-check library with 100 iterations minimum
- All property tests include comments linking to design document properties
- Performance tests should be run on representative hardware
- Security features (memory clearing, audit logging) are critical for production
- The KeyManagementService uses in-memory KEK storage for development; production should integrate with HSM or cloud KMS
