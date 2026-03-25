# Requirements Document

## Introduction

This document specifies the requirements for implementing envelope encryption for medical record payloads in a NestJS healthcare application. Medical records are stored on IPFS with metadata in PostgreSQL and references on the Stellar blockchain. Each record must be encrypted using a unique Data Encryption Key (DEK), which is itself encrypted by a patient-specific Key Encryption Key (KEK) managed through a Key Management Service (KMS).

## Glossary

- **Encryption_Service**: The NestJS service responsible for encrypting and decrypting medical record payloads using envelope encryption
- **Key_Management_Service**: The service responsible for managing Key Encryption Keys (KEKs) and wrapping/unwrapping Data Encryption Keys (DEKs)
- **Medical_Record**: A healthcare document or file containing patient health information
- **Data_Encryption_Key (DEK)**: A symmetric AES-256 key used to encrypt a single medical record payload
- **Key_Encryption_Key (KEK)**: A symmetric key managed by KMS used to encrypt DEKs, unique per patient
- **Encrypted_Record**: A data structure containing the encrypted payload, initialization vector, authentication tag, encrypted DEK, and DEK version
- **IPFS**: InterPlanetary File System, a distributed storage system where encrypted medical record payloads are stored
- **CID**: Content Identifier, a unique hash-based identifier for content stored on IPFS
- **Initialization_Vector (IV)**: A random 12-byte value used with AES-256-GCM to ensure unique ciphertexts
- **Authentication_Tag**: A cryptographic tag produced by AES-256-GCM that ensures data integrity and authenticity
- **PostgreSQL_Database**: The relational database storing medical record metadata including encrypted DEKs and IPFS CIDs

## Requirements

### Requirement 1: Encryption Service Creation

**User Story:** As a healthcare system administrator, I want an encryption service that handles all medical record encryption operations, so that sensitive patient data is protected before storage.

#### Acceptance Criteria

1. THE Encryption_Service SHALL provide an encryptRecord method that accepts a Buffer and patientId string as parameters
2. THE Encryption_Service SHALL provide a decryptRecord method that accepts an Encrypted_Record object and patientId string as parameters
3. THE Encryption_Service SHALL return a Promise from the encryptRecord method
4. THE Encryption_Service SHALL return a Promise from the decryptRecord method
5. THE Encryption_Service SHALL be implemented as a NestJS injectable service

### Requirement 2: Data Encryption Key Generation

**User Story:** As a security engineer, I want each medical record encrypted with a unique DEK, so that compromise of one key does not expose other records.

#### Acceptance Criteria

1. WHEN the encryptRecord method is invoked, THE Encryption_Service SHALL generate a fresh 256-bit Data_Encryption_Key using cryptographically secure random number generation
2. THE Encryption_Service SHALL generate a unique Data_Encryption_Key for each invocation of encryptRecord
3. THE Encryption_Service SHALL use the Data_Encryption_Key for exactly one Medical_Record encryption operation
4. THE Encryption_Service SHALL discard the plaintext Data_Encryption_Key from memory after encryption completes

### Requirement 3: Medical Record Encryption

**User Story:** As a healthcare provider, I want medical records encrypted with AES-256-GCM, so that data confidentiality and integrity are ensured.

#### Acceptance Criteria

1. WHEN encrypting a Medical_Record, THE Encryption_Service SHALL use the AES-256-GCM cipher algorithm
2. WHEN encrypting a Medical_Record, THE Encryption_Service SHALL generate a 12-byte Initialization_Vector using crypto.randomBytes
3. WHEN encrypting a Medical_Record, THE Encryption_Service SHALL produce an Authentication_Tag as part of the encryption operation
4. THE Encryption_Service SHALL encrypt the Medical_Record Buffer using the generated Data_Encryption_Key and Initialization_Vector
5. THE Encryption_Service SHALL ensure each Initialization_Vector is unique and never reused across encryption operations

### Requirement 4: DEK Encryption with KEK

**User Story:** As a security architect, I want DEKs encrypted by patient-specific KEKs, so that key material is protected and access is patient-scoped.

#### Acceptance Criteria

1. WHEN a Data_Encryption_Key is generated, THE Encryption_Service SHALL request the Key_Management_Service to encrypt the DEK using the patient's Key_Encryption_Key
2. THE Encryption_Service SHALL provide the patientId to the Key_Management_Service to identify the correct Key_Encryption_Key
3. THE Encryption_Service SHALL receive an encrypted Data_Encryption_Key from the Key_Management_Service
4. THE Encryption_Service SHALL include the encrypted Data_Encryption_Key in the Encrypted_Record structure

### Requirement 5: Encrypted Record Structure

**User Story:** As a developer, I want a well-defined encrypted record structure, so that all necessary decryption components are available.

#### Acceptance Criteria

1. THE Encrypted_Record interface SHALL include an iv field of type Buffer
2. THE Encrypted_Record interface SHALL include a ciphertext field of type Buffer
3. THE Encrypted_Record interface SHALL include an authTag field of type Buffer
4. THE Encrypted_Record interface SHALL include an encryptedDek field of type Buffer
5. THE Encrypted_Record interface SHALL include a dekVersion field of type string
6. WHEN encryptRecord completes, THE Encryption_Service SHALL return an object conforming to the Encrypted_Record interface

### Requirement 6: Encrypted DEK Storage

**User Story:** As a compliance officer, I want encrypted DEKs stored in PostgreSQL alongside record metadata, so that key material never appears on public storage systems.

#### Acceptance Criteria

1. THE Encryption_Service SHALL provide the encrypted Data_Encryption_Key to the calling service for storage in the PostgreSQL_Database
2. THE Encryption_Service SHALL ensure the encrypted Data_Encryption_Key is stored alongside the IPFS CID in the PostgreSQL_Database
3. THE Encryption_Service SHALL ensure the plaintext Data_Encryption_Key is never stored in the PostgreSQL_Database
4. THE Encryption_Service SHALL ensure the encrypted Data_Encryption_Key is never uploaded to IPFS
5. THE Encryption_Service SHALL ensure the encrypted Data_Encryption_Key is never stored on the Stellar blockchain

### Requirement 7: Medical Record Decryption

**User Story:** As a healthcare provider, I want to decrypt medical records using the encrypted DEK, so that I can access patient information when authorized.

#### Acceptance Criteria

1. WHEN decryptRecord is invoked, THE Encryption_Service SHALL request the Key_Management_Service to decrypt the encrypted Data_Encryption_Key using the patient's Key_Encryption_Key
2. WHEN the plaintext Data_Encryption_Key is obtained, THE Encryption_Service SHALL decrypt the ciphertext using AES-256-GCM with the provided Initialization_Vector
3. WHEN decrypting, THE Encryption_Service SHALL verify the Authentication_Tag to ensure data integrity
4. IF the Authentication_Tag verification fails, THEN THE Encryption_Service SHALL throw an error indicating data corruption or tampering
5. WHEN decryption succeeds, THE Encryption_Service SHALL return the plaintext Medical_Record as a Buffer
6. THE Encryption_Service SHALL discard the plaintext Data_Encryption_Key from memory after decryption completes

### Requirement 8: Key Management Service Encapsulation

**User Story:** As a security architect, I want the Encryption Service to be the sole caller of the Key Management Service, so that key operations are centrally controlled and auditable.

#### Acceptance Criteria

1. THE Encryption_Service SHALL be the only module permitted to invoke methods on the Key_Management_Service
2. THE Encryption_Service module SHALL enforce encapsulation through NestJS module dependency injection configuration
3. THE Key_Management_Service SHALL be declared as a private provider within the Encryption_Service module
4. THE Key_Management_Service SHALL not be exported from the Encryption_Service module for use by other modules

### Requirement 9: Encryption Performance

**User Story:** As a system operator, I want encryption and decryption to complete quickly, so that medical record operations do not impact user experience.

#### Acceptance Criteria

1. WHEN encrypting and then decrypting a 10 megabyte Medical_Record file, THE Encryption_Service SHALL complete both operations within 500 milliseconds
2. THE Encryption_Service SHALL be benchmarked under typical system load conditions
3. IF the performance requirement is not met, THEN THE Encryption_Service SHALL log performance metrics for investigation

### Requirement 10: Initialization Vector Security

**User Story:** As a cryptography expert, I want initialization vectors generated securely and uniquely, so that encryption security properties are maintained.

#### Acceptance Criteria

1. THE Encryption_Service SHALL generate each Initialization_Vector using the crypto.randomBytes function with a length of 12 bytes
2. THE Encryption_Service SHALL ensure Initialization_Vectors are never hardcoded in source code
3. THE Encryption_Service SHALL ensure Initialization_Vectors are never reused across different encryption operations
4. THE Encryption_Service SHALL include the Initialization_Vector in the Encrypted_Record structure for use during decryption

### Requirement 11: Error Handling for Corrupted Data

**User Story:** As a security engineer, I want the system to detect corrupted or tampered ciphertext, so that compromised data is not processed.

#### Acceptance Criteria

1. WHEN the Authentication_Tag verification fails during decryption, THE Encryption_Service SHALL throw a descriptive error
2. WHEN the encrypted Data_Encryption_Key cannot be decrypted by the Key_Management_Service, THE Encryption_Service SHALL throw a descriptive error
3. WHEN decryption fails, THE Encryption_Service SHALL log the failure with sufficient context for security auditing
4. THE Encryption_Service SHALL ensure failed decryption attempts do not leak information about the plaintext or key material

### Requirement 12: Unit Test Coverage

**User Story:** As a quality assurance engineer, I want comprehensive unit tests for the encryption service, so that correctness and security are verified.

#### Acceptance Criteria

1. THE Encryption_Service unit tests SHALL include a test case for successful encrypt and decrypt round-trip operations
2. THE Encryption_Service unit tests SHALL include a test case for corrupted ciphertext resulting in Authentication_Tag verification failure
3. THE Encryption_Service unit tests SHALL include a test case for missing or invalid encrypted Data_Encryption_Key
4. THE Encryption_Service unit tests SHALL verify that unique Data_Encryption_Keys are generated for each encryption operation
5. THE Encryption_Service unit tests SHALL verify that unique Initialization_Vectors are generated for each encryption operation
6. THE Encryption_Service unit tests SHALL achieve at least 90 percent code coverage for the Encryption_Service module

### Requirement 13: Key Management Service Interface

**User Story:** As a developer, I want a clear interface for the Key Management Service, so that integration with the Encryption Service is straightforward.

#### Acceptance Criteria

1. THE Key_Management_Service SHALL provide a wrapDek method that accepts a plaintext DEK Buffer and patientId string
2. THE Key_Management_Service SHALL provide an unwrapDek method that accepts an encrypted DEK Buffer and patientId string
3. WHEN wrapDek is invoked, THE Key_Management_Service SHALL return the encrypted DEK as a Buffer
4. WHEN unwrapDek is invoked, THE Key_Management_Service SHALL return the plaintext DEK as a Buffer
5. THE Key_Management_Service SHALL retrieve the patient's Key_Encryption_Key using the provided patientId

### Requirement 14: DEK Version Tracking

**User Story:** As a system administrator, I want DEK versions tracked, so that key rotation and cryptographic agility are supported.

#### Acceptance Criteria

1. THE Encryption_Service SHALL include a dekVersion field in the Encrypted_Record structure
2. WHEN encrypting a Medical_Record, THE Encryption_Service SHALL populate the dekVersion field with the current DEK version identifier
3. THE Encryption_Service SHALL obtain the DEK version identifier from the Key_Management_Service
4. WHEN decrypting a Medical_Record, THE Encryption_Service SHALL use the dekVersion field to ensure correct key material is used
