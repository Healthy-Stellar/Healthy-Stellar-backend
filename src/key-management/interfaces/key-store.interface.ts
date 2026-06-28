/**
 * KeyStore Interface
 *
 * Abstraction for secure storage of Stellar secret keys.
 * Supports pluggable backends: database (local/test) and AWS KMS (production).
 *
 * Each stored key is identified by a logical keyId (e.g. a Stellar public key
 * or a tenant identifier) and kept encrypted at rest.
 */
export interface StoredKey {
  /** Opaque identifier used to retrieve the key (e.g. public key, tenant ID) */
  keyId: string;
  /** Base64-encoded ciphertext of the secret key */
  ciphertext: string;
  /** KMS key ARN / version label used to encrypt this key (human-readable metadata) */
  keyVersion: string;
  /** ISO-8601 timestamp of when this entry was created */
  createdAt: string;
}

export interface KeyStore {
  /**
   * Store a secret key under the given keyId.
   * Implementations MUST encrypt the secret before persisting it.
   */
  storeKey(keyId: string, secretKey: string): Promise<void>;

  /**
   * Retrieve and decrypt a secret key by its keyId.
   * @throws KeyNotFoundException if the keyId does not exist
   */
  retrieveKey(keyId: string): Promise<string>;

  /**
   * Delete a stored key entry.
   * No-op if the keyId does not exist.
   */
  deleteKey(keyId: string): Promise<void>;

  /**
   * List all stored key IDs (for audit / administration).
   */
  listKeys(): Promise<StoredKey[]>;

  /**
   * Rotate the underlying encryption key, re-wrapping all stored secrets.
   * Returns the number of successfully re-wrapped keys.
   */
  rotateWrappingKey(): Promise<{ rewrappedCount: number }>;
}

export const KEY_STORE = 'KEY_STORE';
