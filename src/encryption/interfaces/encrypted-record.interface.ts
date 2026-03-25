/**
 * Encrypted Record Interface
 * 
 * Data structure containing all components necessary for decrypting a medical record.
 * This interface represents the output of envelope encryption operations.
 * 
 * Storage Distribution:
 * - ciphertext: Stored on IPFS, referenced by CID
 * - iv, authTag, encryptedDek, dekVersion: Stored in PostgreSQL
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
export interface EncryptedRecord {
  /**
   * The initialization vector used for AES-256-GCM encryption (12 bytes)
   * Generated using crypto.randomBytes for each encryption operation
   */
  iv: Buffer;

  /**
   * The encrypted medical record payload
   * Encrypted using AES-256-GCM with a unique Data Encryption Key (DEK)
   */
  ciphertext: Buffer;

  /**
   * The authentication tag produced by AES-256-GCM (16 bytes)
   * Used to verify data integrity and authenticity during decryption
   */
  authTag: Buffer;

  /**
   * The Data Encryption Key (DEK) encrypted with the patient's Key Encryption Key (KEK)
   * The plaintext DEK is never stored; only this encrypted version is persisted
   */
  encryptedDek: Buffer;

  /**
   * The version identifier for the DEK encryption scheme
   * Supports key rotation and cryptographic agility
   */
  dekVersion: string;
}
